// ============================================================
// 重庆-丰都旅游攻略 - Cloudflare Workers API
// 支持 itinerary + places 双表结构
// ============================================================

const GITHUB_BASE = 'https://raw.githubusercontent.com/tuboshu5418/chongqing-travel-images/main';
const AMAP_URI_BASE = 'https://uri.amap.com/marker';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const db = env['travel_data'];

        try {

            // ============================================================
            // 1. 管理员验证
            // ============================================================
            if (path === '/api/admin/verify' && method === 'POST') {
                const { password } = await request.json();
                const hash = await sha256(password);
                const result = await db.prepare(
                    'SELECT username FROM admin WHERE password_hash = ?'
                ).bind(hash).first();
                return jsonResponse(result ? { success: true } : { success: false, error: '密码错误' }, result ? 200 : 401);
            }

            // ============================================================
            // 2. 获取完整行程数据（itinerary + places 关联）
            // ============================================================
            if (path === '/api/itinerary' && method === 'GET') {
                // 获取所有天的行程框架
                const { results: days } = await db.prepare(
                    'SELECT * FROM itinerary ORDER BY day ASC'
                ).all();

                // 获取所有景点
                const { results: allPlaces } = await db.prepare(
                    'SELECT * FROM places ORDER BY day, sort_order'
                ).all();

                // 按天组装数据
                const result = days.map(day => {
                    const placeIds = day.place_order ? JSON.parse(day.place_order) : [];
                    const places = placeIds
                        .map(id => allPlaces.find(p => p.id === id))
                        .filter(p => p !== undefined);
                    return {
                        ...day,
                        places: places,
                        place_order: placeIds,
                        day_alternatives: day.day_alternatives ? JSON.parse(day.day_alternatives) : {},
                    };
                });

                return jsonResponse(result);
            }

            // ============================================================
            // 3. 获取单天行程
            // ============================================================
            if (path.startsWith('/api/itinerary/') && method === 'GET') {
                const dayNum = parseInt(path.split('/').pop());
                if (isNaN(dayNum)) return jsonResponse({ error: 'Invalid day' }, 400);

                const day = await db.prepare(
                    'SELECT * FROM itinerary WHERE day = ?'
                ).bind(dayNum).first();

                if (!day) return jsonResponse({ error: 'Day not found' }, 404);

                const placeIds = day.place_order ? JSON.parse(day.place_order) : [];
                let places = [];
                if (placeIds.length > 0) {
                    const placeholders = placeIds.map(() => '?').join(',');
                    const { results } = await db.prepare(
                        `SELECT * FROM places WHERE id IN (${placeholders}) ORDER BY sort_order`
                    ).bind(...placeIds).all();
                    // 按 place_order 顺序排序
                    const placeMap = {};
                    results.forEach(p => placeMap[p.id] = p);
                    places = placeIds.map(id => placeMap[id]).filter(p => p !== undefined);
                }

                return jsonResponse({
                    ...day,
                    places: places,
                    place_order: placeIds,
                    day_alternatives: day.day_alternatives ? JSON.parse(day.day_alternatives) : {},
                });
            }

            // ============================================================
            // 4. 更新行程（PUT）
            // ============================================================
            if (path.startsWith('/api/itinerary/') && method === 'PUT') {
                const dayNum = parseInt(path.split('/').pop());
                if (isNaN(dayNum)) return jsonResponse({ error: 'Invalid day' }, 400);

                const body = await request.json();
                const { password, title, subtitle, walk_badge, rest_note, breakfast, lunch, dinner, place_order, day_alternatives, notes } = body;

                // 验证密码
                const hash = await sha256(password);
                const admin = await db.prepare(
                    'SELECT username FROM admin WHERE password_hash = ?'
                ).bind(hash).first();
                if (!admin) return jsonResponse({ error: '密码错误' }, 401);

                const existing = await db.prepare(
                    'SELECT day FROM itinerary WHERE day = ?'
                ).bind(dayNum).first();
                if (!existing) return jsonResponse({ error: 'Day not found' }, 404);

                const updates = [];
                const values = [];
                if (title !== undefined) { updates.push('title = ?');
                    values.push(title); }
                if (subtitle !== undefined) { updates.push('subtitle = ?');
                    values.push(subtitle); }
                if (walk_badge !== undefined) { updates.push('walk_badge = ?');
                    values.push(walk_badge); }
                if (rest_note !== undefined) { updates.push('rest_note = ?');
                    values.push(rest_note); }
                if (breakfast !== undefined) { updates.push('breakfast = ?');
                    values.push(breakfast); }
                if (lunch !== undefined) { updates.push('lunch = ?');
                    values.push(lunch); }
                if (dinner !== undefined) { updates.push('dinner = ?');
                    values.push(dinner); }
                if (place_order !== undefined) { updates.push('place_order = ?');
                    values.push(JSON.stringify(place_order)); }
                if (day_alternatives !== undefined) { updates.push('day_alternatives = ?');
                    values.push(JSON.stringify(day_alternatives)); }
                if (notes !== undefined) { updates.push('notes = ?');
                    values.push(notes); }

                if (updates.length === 0) return jsonResponse({ error: 'No fields' }, 400);

                values.push(dayNum);
                await db.prepare(
                    `UPDATE itinerary SET ${updates.join(', ')} WHERE day = ?`
                ).bind(...values).run();

                // 返回更新后的数据
                const updated = await db.prepare(
                    'SELECT * FROM itinerary WHERE day = ?'
                ).bind(dayNum).first();

                const placeIds = updated.place_order ? JSON.parse(updated.place_order) : [];
                let places = [];
                if (placeIds.length > 0) {
                    const placeholders = placeIds.map(() => '?').join(',');
                    const { results } = await db.prepare(
                        `SELECT * FROM places WHERE id IN (${placeholders})`
                    ).bind(...placeIds).all();
                    const placeMap = {};
                    results.forEach(p => placeMap[p.id] = p);
                    places = placeIds.map(id => placeMap[id]).filter(p => p !== undefined);
                }

                return jsonResponse({
                    ...updated,
                    places: places,
                    place_order: placeIds,
                    day_alternatives: updated.day_alternatives ? JSON.parse(updated.day_alternatives) : {},
                });
            }

            // ============================================================
            // 5. 景点 CRUD
            // ============================================================
            // 5.1 新增景点
            if (path === '/api/places' && method === 'POST') {
                const body = await request.json();
                const { password, name, type, day, time_start, time_end, duration, intro, address, nav_link, image_url, platform_links, remark, map_x, map_y, sort_order, peak_alternative, congestion_alternative, rainy_alternative } = body;

                const hash = await sha256(password);
                const admin = await db.prepare(
                    'SELECT username FROM admin WHERE password_hash = ?'
                ).bind(hash).first();
                if (!admin) return jsonResponse({ error: '密码错误' }, 401);

                const result = await db.prepare(
                    `INSERT INTO places 
                     (name, type, day, time_start, time_end, duration, intro, address, nav_link, image_url, platform_links, remark, map_x, map_y, sort_order, peak_alternative, congestion_alternative, rainy_alternative)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    name, type, day, time_start || '', time_end || '', duration || '',
                    intro || '', address || '', nav_link || '', image_url || '',
                    platform_links || '', remark || '', map_x || 0, map_y || 0,
                    sort_order || 0, peak_alternative || '', congestion_alternative || '', rainy_alternative || ''
                ).run();

                return jsonResponse({ success: true, id: result.meta.last_row_id }, 201);
            }

            // 5.2 更新景点
            if (path.startsWith('/api/places/') && method === 'PUT') {
                const id = parseInt(path.split('/').pop());
                if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

                const body = await request.json();
                const { password, name, type, day, time_start, time_end, duration, intro, address, nav_link, image_url, platform_links, remark, map_x, map_y, sort_order, peak_alternative, congestion_alternative, rainy_alternative } = body;

                const hash = await sha256(password);
                const admin = await db.prepare(
                    'SELECT username FROM admin WHERE password_hash = ?'
                ).bind(hash).first();
                if (!admin) return jsonResponse({ error: '密码错误' }, 401);

                const existing = await db.prepare(
                    'SELECT id FROM places WHERE id = ?'
                ).bind(id).first();
                if (!existing) return jsonResponse({ error: 'Place not found' }, 404);

                const updates = [];
                const values = [];
                if (name !== undefined) { updates.push('name = ?');
                    values.push(name); }
                if (type !== undefined) { updates.push('type = ?');
                    values.push(type); }
                if (day !== undefined) { updates.push('day = ?');
                    values.push(day); }
                if (time_start !== undefined) { updates.push('time_start = ?');
                    values.push(time_start); }
                if (time_end !== undefined) { updates.push('time_end = ?');
                    values.push(time_end); }
                if (duration !== undefined) { updates.push('duration = ?');
                    values.push(duration); }
                if (intro !== undefined) { updates.push('intro = ?');
                    values.push(intro); }
                if (address !== undefined) { updates.push('address = ?');
                    values.push(address); }
                if (nav_link !== undefined) { updates.push('nav_link = ?');
                    values.push(nav_link); }
                if (image_url !== undefined) { updates.push('image_url = ?');
                    values.push(image_url); }
                if (platform_links !== undefined) { updates.push('platform_links = ?');
                    values.push(platform_links); }
                if (remark !== undefined) { updates.push('remark = ?');
                    values.push(remark); }
                if (map_x !== undefined) { updates.push('map_x = ?');
                    values.push(map_x); }
                if (map_y !== undefined) { updates.push('map_y = ?');
                    values.push(map_y); }
                if (sort_order !== undefined) { updates.push('sort_order = ?');
                    values.push(sort_order); }
                if (peak_alternative !== undefined) { updates.push('peak_alternative = ?');
                    values.push(peak_alternative); }
                if (congestion_alternative !== undefined) { updates.push('congestion_alternative = ?');
                    values.push(congestion_alternative); }
                if (rainy_alternative !== undefined) { updates.push('rainy_alternative = ?');
                    values.push(rainy_alternative); }

                if (updates.length === 0) return jsonResponse({ error: 'No fields' }, 400);

                values.push(id);
                await db.prepare(
                    `UPDATE places SET ${updates.join(', ')} WHERE id = ?`
                ).bind(...values).run();

                const updated = await db.prepare(
                    'SELECT * FROM places WHERE id = ?'
                ).bind(id).first();

                return jsonResponse({ success: true, data: updated });
            }

            // 5.3 删除景点
            if (path.startsWith('/api/places/') && method === 'DELETE') {
                const id = parseInt(path.split('/').pop());
                if (isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

                const body = await request.json();
                const { password } = body;

                const hash = await sha256(password);
                const admin = await db.prepare(
                    'SELECT username FROM admin WHERE password_hash = ?'
                ).bind(hash).first();
                if (!admin) return jsonResponse({ error: '密码错误' }, 401);

                const existing = await db.prepare(
                    'SELECT id FROM places WHERE id = ?'
                ).bind(id).first();
                if (!existing) return jsonResponse({ error: 'Place not found' }, 404);

                await db.prepare('DELETE FROM places WHERE id = ?').bind(id).run();

                return jsonResponse({ success: true, deleted: id });
            }

            // ============================================================
            // 6. 获取所有景点（用于管理）
            // ============================================================
            if (path === '/api/places' && method === 'GET') {
                const { results } = await db.prepare(
                    'SELECT * FROM places ORDER BY day, sort_order'
                ).all();
                return jsonResponse(results);
            }

            // ============================================================
            // 7. 高德导航链接
            // ============================================================
            if (path === '/api/amap-link') {
                const params = url.searchParams;
                const lng = params.get('lng');
                const lat = params.get('lat');
                const name = params.get('name') || '目的地';
                if (!lng || !lat) return jsonResponse({ error: '缺少经纬度' }, 400);
                return jsonResponse({
                    link: `${AMAP_URI_BASE}?position=${lng},${lat}&name=${encodeURIComponent(name)}`
                });
            }

            if (path === '/api/images/base') {
                return jsonResponse({ github: GITHUB_BASE });
            }

            // ============================================================
            // 8. 静态资源
            // ============================================================
            return env.ASSETS.fetch(request);

        } catch (error) {
            console.error('API Error:', error);
            return jsonResponse({ error: error.message }, 500);
        }
    }
};     

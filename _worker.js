// ============================================================
// 重庆-丰都旅游攻略 - Cloudflare Workers API
// 支持行程 + 交通方式管理
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
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
            // 2. 行程 API
            // ============================================================
            if (path.startsWith('/api/itinerary')) {
                const parts = path.split('/');
                const dayParam = parts[parts.length - 1];
                const dayNumber = parseInt(dayParam);

                // ---- GET ----
                if (method === 'GET') {
                    if (!isNaN(dayNumber) && dayNumber > 0) {
                        const result = await db.prepare(
                            'SELECT * FROM itinerary WHERE day = ?'
                        ).bind(dayNumber).first();
                        if (!result) return jsonResponse({ error: 'Not found' }, 404);
                        if (result.schedule) result.schedule = JSON.parse(result.schedule);
                        if (result.places) result.places = JSON.parse(result.places);
                        if (result.transport_ids) {
                            const ids = JSON.parse(result.transport_ids);
                            const placeholders = ids.map(() => '?').join(',');
                            if (ids.length > 0) {
                                const transports = await db.prepare(
                                    `SELECT * FROM transport WHERE id IN (${placeholders}) ORDER BY sort_order`
                                ).bind(...ids).all();
                                result.transports = transports.results;
                            } else {
                                result.transports = [];
                            }
                        }
                        return jsonResponse(result);
                    }

                    // 查询所有天
                    const { results } = await db.prepare(
                        'SELECT * FROM itinerary ORDER BY day ASC'
                    ).all();

                    for (const row of results) {
                        if (row.schedule) row.schedule = JSON.parse(row.schedule);
                        if (row.places) row.places = JSON.parse(row.places);
                        if (row.transport_ids) {
                            const ids = JSON.parse(row.transport_ids);
                            const placeholders = ids.map(() => '?').join(',');
                            if (ids.length > 0) {
                                const transports = await db.prepare(
                                    `SELECT * FROM transport WHERE id IN (${placeholders}) ORDER BY sort_order`
                                ).bind(...ids).all();
                                row.transports = transports.results;
                            } else {
                                row.transports = [];
                            }
                        }
                    }
                    return jsonResponse(results);
                }

                // ---- POST（新建一天） ----
                if (method === 'POST') {
                    const body = await request.json();
                    const { password, title, subtitle, walk_badge, rest_note, breakfast, lunch, dinner, schedule, places, transport_ids } = body;

                    // 验证密码
                    const hash = await sha256(password);
                    const admin = await db.prepare(
                        'SELECT username FROM admin WHERE password_hash = ?'
                    ).bind(hash).first();
                    if (!admin) return jsonResponse({ error: '密码错误' }, 401);

                    // 获取当前最大 day
                    const maxDay = await db.prepare('SELECT MAX(day) as max FROM itinerary').first();
                    const newDay = (maxDay?.max || 0) + 1;

                    const result = await db.prepare(
                        `INSERT INTO itinerary (day, title, subtitle, walk_badge, rest_note, breakfast, lunch, dinner, schedule, places, transport_ids)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(
                        newDay,
                        title || `Day ${newDay}`,
                        subtitle || '',
                        walk_badge || '',
                        rest_note || '',
                        breakfast || '',
                        lunch || '',
                        dinner || '',
                        JSON.stringify(schedule || []),
                        JSON.stringify(places || []),
                        JSON.stringify(transport_ids || [])
                    ).run();

                    const inserted = await db.prepare(
                        'SELECT * FROM itinerary WHERE day = ?'
                    ).bind(newDay).first();
                    if (inserted.schedule) inserted.schedule = JSON.parse(inserted.schedule);
                    if (inserted.places) inserted.places = JSON.parse(inserted.places);
                    return jsonResponse({ success: true, data: inserted }, 201);
                }

                // ---- PUT（更新） ----
                if (method === 'PUT') {
                    if (isNaN(dayNumber) || dayNumber <= 0) {
                        return jsonResponse({ error: 'Invalid day' }, 400);
                    }

                    const body = await request.json();
                    const { password, title, subtitle, walk_badge, rest_note, breakfast, lunch, dinner, schedule, places, transport_ids } = body;

                    const hash = await sha256(password);
                    const admin = await db.prepare(
                        'SELECT username FROM admin WHERE password_hash = ?'
                    ).bind(hash).first();
                    if (!admin) return jsonResponse({ error: '密码错误' }, 401);

                    const existing = await db.prepare(
                        'SELECT id FROM itinerary WHERE day = ?'
                    ).bind(dayNumber).first();
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
                    if (schedule !== undefined) { updates.push('schedule = ?');
                        values.push(JSON.stringify(schedule)); }
                    if (places !== undefined) { updates.push('places = ?');
                        values.push(JSON.stringify(places)); }
                    if (transport_ids !== undefined) { updates.push('transport_ids = ?');
                        values.push(JSON.stringify(transport_ids)); }

                    if (updates.length === 0) return jsonResponse({ error: 'No fields' }, 400);

                    values.push(dayNumber);
                    await db.prepare(
                        `UPDATE itinerary SET ${updates.join(', ')} WHERE day = ?`
                    ).bind(...values).run();

                    const updated = await db.prepare(
                        'SELECT * FROM itinerary WHERE day = ?'
                    ).bind(dayNumber).first();
                    if (updated.schedule) updated.schedule = JSON.parse(updated.schedule);
                    if (updated.places) updated.places = JSON.parse(updated.places);
                    return jsonResponse({ success: true, data: updated });
                }

                // ---- DELETE ----
                if (method === 'DELETE') {
                    if (isNaN(dayNumber) || dayNumber <= 0) {
                        return jsonResponse({ error: 'Invalid day' }, 400);
                    }
                    const body = await request.json();
                    const { password } = body;
                    const hash = await sha256(password);
                    const admin = await db.prepare(
                        'SELECT username FROM admin WHERE password_hash = ?'
                    ).bind(hash).first();
                    if (!admin) return jsonResponse({ error: '密码错误' }, 401);

                    const existing = await db.prepare(
                        'SELECT id FROM itinerary WHERE day = ?'
                    ).bind(dayNumber).first();
                    if (!existing) return jsonResponse({ error: 'Day not found' }, 404);

                    await db.prepare('DELETE FROM itinerary WHERE day = ?').bind(dayNumber).run();
                    return jsonResponse({ success: true, deleted: dayNumber });
                }

                return jsonResponse({ error: 'Method not allowed' }, 405);
            }

            // ============================================================
            // 3. 交通方式 API
            // ============================================================
            if (path.startsWith('/api/transport')) {
                const parts = path.split('/');
                const idParam = parts[parts.length - 1];
                const id = parseInt(idParam);

                // ---- GET（查询某一天的交通） ----
                if (method === 'GET') {
                    if (!isNaN(id) && id > 0) {
                        // 查询某一天的交通
                        const results = await db.prepare(
                            'SELECT * FROM transport WHERE day = ? ORDER BY sort_order'
                        ).bind(id).all();
                        return jsonResponse(results.results);
                    }
                    // 查询所有交通
                    const results = await db.prepare(
                        'SELECT * FROM transport ORDER BY day, sort_order'
                    ).all();
                    return jsonResponse(results.results);
                }

                // ---- POST（新增交通） ----
                if (method === 'POST') {
                    const body = await request.json();
                    const { password, day, from_place, to_place, mode, detail, departure, arrival, duration, notes } = body;

                    const hash = await sha256(password);
                    const admin = await db.prepare(
                        'SELECT username FROM admin WHERE password_hash = ?'
                    ).bind(hash).first();
                    if (!admin) return jsonResponse({ error: '密码错误' }, 401);

                    const result = await db.prepare(
                        `INSERT INTO transport (day, from_place, to_place, mode, detail, departure, arrival, duration, notes, sort_order)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM transport WHERE day = ?))`
                    ).bind(day, from_place, to_place, mode, detail || '', departure || '', arrival || '', duration || '', notes || '', day).run();

                    return jsonResponse({ success: true, id: result.meta.last_row_id }, 201);
                }

                // ---- PUT（更新交通） ----
                if (method === 'PUT') {
                    if (isNaN(id) || id <= 0) return jsonResponse({ error: 'Invalid id' }, 400);
                    const body = await request.json();
                    const { password, from_place, to_place, mode, detail, departure, arrival, duration, notes, sort_order } = body;

                    const hash = await sha256(password);
                    const admin = await db.prepare(
                        'SELECT username FROM admin WHERE password_hash = ?'
                    ).bind(hash).first();
                    if (!admin) return jsonResponse({ error: '密码错误' }, 401);

                    const existing = await db.prepare(
                        'SELECT id FROM transport WHERE id = ?'
                    ).bind(id).first();
                    if (!existing) return jsonResponse({ error: 'Not found' }, 404);

                    const updates = [];
                    const values = [];
                    if (from_place !== undefined) { updates.push('from_place = ?');
                        values.push(from_place); }
                    if (to_place !== undefined) { updates.push('to_place = ?');
                        values.push(to_place); }
                    if (mode !== undefined) { updates.push('mode = ?');
                        values.push(mode); }
                    if (detail !== undefined) { updates.push('detail = ?');
                        values.push(detail); }
                    if (departure !== undefined) { updates.push('departure = ?');
                        values.push(departure); }
                    if (arrival !== undefined) { updates.push('arrival = ?');
                        values.push(arrival); }
                    if (duration !== undefined) { updates.push('duration = ?');
                        values.push(duration); }
                    if (notes !== undefined) { updates.push('notes = ?');
                        values.push(notes); }
                    if (sort_order !== undefined) { updates.push('sort_order = ?');
                        values.push(sort_order); }

                    if (updates.length === 0) return jsonResponse({ error: 'No fields' }, 400);
                    values.push(id);
                    await db.prepare(
                        `UPDATE transport SET ${updates.join(', ')} WHERE id = ?`
                    ).bind(...values).run();

                    const updated = await db.prepare(
                        'SELECT * FROM transport WHERE id = ?'
                    ).bind(id).first();
                    return jsonResponse({ success: true, data: updated });
                }

                // ---- DELETE ----
                if (method === 'DELETE') {
                    if (isNaN(id) || id <= 0) return jsonResponse({ error: 'Invalid id' }, 400);
                    const body = await request.json();
                    const { password } = body;
                    const hash = await sha256(password);
                    const admin = await db.prepare(
                        'SELECT username FROM admin WHERE password_hash = ?'
                    ).bind(hash).first();
                    if (!admin) return jsonResponse({ error: '密码错误' }, 401);

                    const existing = await db.prepare(
                        'SELECT id FROM transport WHERE id = ?'
                    ).bind(id).first();
                    if (!existing) return jsonResponse({ error: 'Not found' }, 404);

                    await db.prepare('DELETE FROM transport WHERE id = ?').bind(id).run();

                    // 同时从 itinerary 的 transport_ids 中移除
                    // 这个需要遍历所有 itinerary 更新，简单起见留空，但前端可处理
                    return jsonResponse({ success: true, deleted: id });
                }

                return jsonResponse({ error: 'Method not allowed' }, 405);
            }

            // ============================================================
            // 4. 其他 API
            // ============================================================
            if (path === '/api/amap-link') {
                const params = url.searchParams;
                const lng = params.get('lng');
                const lat = params.get('lat');
                const name = params.get('name') || '目的地';
                if (!lng || !lat) return jsonResponse({ error: '缺少经纬度' }, 400);
                return jsonResponse({ link: `${AMAP_URI_BASE}?position=${lng},${lat}&name=${encodeURIComponent(name)}` });
            }

            if (path === '/api/images/base') {
                return jsonResponse({ github: GITHUB_BASE });
            }

            // ============================================================
            // 5. 静态资源
            // ============================================================
            return env.ASSETS.fetch(request);

        } catch (error) {
            console.error('API Error:', error);
            return jsonResponse({ error: error.message }, 500);
        }
    }
};

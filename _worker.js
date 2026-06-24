// ============================================================
// 重庆-丰都旅游攻略 - Cloudflare Workers
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

// SHA256 加密函数
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

        // ============================================================
        // 1. 管理员验证
        // ============================================================
        if (path === '/api/admin/verify' && method === 'POST') {
            try {
                const { password } = await request.json();
                const hash = await sha256(password);
                const result = await db.prepare(
                    'SELECT username FROM admin WHERE password_hash = ?'
                ).bind(hash).first();
                
                if (result) {
                    return jsonResponse({ success: true });
                } else {
                    return jsonResponse({ success: false, error: '密码错误' }, 401);
                }
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        // ============================================================
        // 2. 更新行程（需要验证）
        // ============================================================
        if (path === '/api/itinerary/update' && method === 'POST') {
            try {
                const { password, day, title, subtitle, walk_badge, rest_note, breakfast, lunch, dinner, schedule, places } = await request.json();
                
                // 验证密码
                const hash = await sha256(password);
                const admin = await db.prepare(
                    'SELECT username FROM admin WHERE password_hash = ?'
                ).bind(hash).first();
                
                if (!admin) {
                    return jsonResponse({ error: '密码错误，无权修改' }, 401);
                }

                // 更新行程
                const updates = [];
                const values = [];

                if (title !== undefined) { updates.push('title = ?'); values.push(title); }
                if (subtitle !== undefined) { updates.push('subtitle = ?'); values.push(subtitle); }
                if (walk_badge !== undefined) { updates.push('walk_badge = ?'); values.push(walk_badge); }
                if (rest_note !== undefined) { updates.push('rest_note = ?'); values.push(rest_note); }
                if (breakfast !== undefined) { updates.push('breakfast = ?'); values.push(breakfast); }
                if (lunch !== undefined) { updates.push('lunch = ?'); values.push(lunch); }
                if (dinner !== undefined) { updates.push('dinner = ?'); values.push(dinner); }
                if (schedule !== undefined) { updates.push('schedule = ?'); values.push(JSON.stringify(schedule)); }
                if (places !== undefined) { updates.push('places = ?'); values.push(JSON.stringify(places)); }

                if (updates.length === 0) {
                    return jsonResponse({ error: '没有要更新的字段' }, 400);
                }

                values.push(day);
                const query = `UPDATE itinerary SET ${updates.join(', ')} WHERE day = ?`;
                await db.prepare(query).bind(...values).run();

                // 返回更新后的数据
                const updated = await db.prepare(
                    'SELECT * FROM itinerary WHERE day = ?'
                ).bind(day).first();

                if (updated.schedule) updated.schedule = JSON.parse(updated.schedule);
                if (updated.places) updated.places = JSON.parse(updated.places);

                return jsonResponse({ success: true, data: updated });
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        // ============================================================
        // 3. 获取行程数据
        // ============================================================
        if (path.startsWith('/api/itinerary')) {
            const parts = path.split('/');
            const dayParam = parts[parts.length - 1];
            const dayNumber = parseInt(dayParam);

            if (method === 'GET') {
                try {
                    if (!isNaN(dayNumber) && dayNumber > 0) {
                        const result = await db.prepare(
                            'SELECT * FROM itinerary WHERE day = ?'
                        ).bind(dayNumber).first();

                        if (!result) {
                            return jsonResponse({ error: `Day ${dayNumber} not found` }, 404);
                        }

                        if (result.schedule) result.schedule = JSON.parse(result.schedule);
                        if (result.places) result.places = JSON.parse(result.places);
                        return jsonResponse(result);
                    }

                    const { results } = await db.prepare(
                        'SELECT * FROM itinerary ORDER BY day ASC'
                    ).all();

                    const parsedResults = results.map(row => ({
                        ...row,
                        schedule: row.schedule ? JSON.parse(row.schedule) : [],
                        places: row.places ? JSON.parse(row.places) : [],
                    }));

                    return jsonResponse(parsedResults);
                } catch (e) {
                    return jsonResponse({ error: '数据库查询失败: ' + e.message }, 500);
                }
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
            if (!lng || !lat) {
                return jsonResponse({ error: '缺少经纬度参数' }, 400);
            }
            return jsonResponse({
                link: `${AMAP_URI_BASE}?position=${lng},${lat}&name=${encodeURIComponent(name)}`
            });
        }

        if (path === '/api/images/base') {
            return jsonResponse({ github: GITHUB_BASE });
        }

        if (path.startsWith('/api/')) {
            return jsonResponse({ error: 'API not found' }, 404);
        }

        // ============================================================
        // 5. 静态资源托管
        // ============================================================
        return env.ASSETS.fetch(request);
    }
};

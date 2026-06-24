// ============================================================
// 重庆旅游攻略 - Cloudflare Workers API
// ============================================================

// 高德地图 API Key（请替换为你自己的）
const AMAP_KEY = 'YOUR_AMAP_KEY_HERE';

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

function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        if (method === 'OPTIONS') {
            return handleOptions();
        }

        const db = env.travel_data;

        try {
            // ============================================================
            // 高德地图 Key
            // ============================================================
            if (path === '/api/amap-key') {
                return jsonResponse({ key: AMAP_KEY });
            }

            // ============================================================
            // 行程 API
            // ============================================================
            if (path.startsWith('/api/itinerary')) {
                const parts = path.split('/');
                const dayParam = parts[parts.length - 1];
                const dayNumber = parseInt(dayParam);

                // GET - 查询
                if (method === 'GET') {
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
                }

                // PUT - 更新
                if (method === 'PUT') {
                    if (isNaN(dayNumber) || dayNumber <= 0) {
                        return jsonResponse({ error: 'Invalid day parameter' }, 400);
                    }

                    const body = await request.json();
                    const { title, subtitle, walk_badge, rest_note, lunch_recommendation, schedule, places } = body;

                    const existing = await db.prepare(
                        'SELECT id FROM itinerary WHERE day = ?'
                    ).bind(dayNumber).first();

                    if (!existing) {
                        return jsonResponse({ error: `Day ${dayNumber} not found` }, 404);
                    }

                    const updates = [];
                    const values = [];

                    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
                    if (subtitle !== undefined) { updates.push('subtitle = ?'); values.push(subtitle); }
                    if (walk_badge !== undefined) { updates.push('walk_badge = ?'); values.push(walk_badge); }
                    if (rest_note !== undefined) { updates.push('rest_note = ?'); values.push(rest_note); }
                    if (lunch_recommendation !== undefined) { updates.push('lunch_recommendation = ?'); values.push(lunch_recommendation); }
                    if (schedule !== undefined) { updates.push('schedule = ?'); values.push(JSON.stringify(schedule)); }
                    if (places !== undefined) { updates.push('places = ?'); values.push(JSON.stringify(places)); }

                    if (updates.length === 0) {
                        return jsonResponse({ error: 'No fields to update' }, 400);
                    }

                    values.push(dayNumber);
                    const query = `UPDATE itinerary SET ${updates.join(', ')} WHERE day = ?`;
                    await db.prepare(query).bind(...values).run();

                    const updated = await db.prepare(
                        'SELECT * FROM itinerary WHERE day = ?'
                    ).bind(dayNumber).first();

                    if (updated.schedule) updated.schedule = JSON.parse(updated.schedule);
                    if (updated.places) updated.places = JSON.parse(updated.places);

                    return jsonResponse(updated);
                }

                return jsonResponse({ error: 'Method not allowed' }, 405);
            }

            // ============================================================
            // 静态页面 - 返回 index.html
            // ============================================================
            if (path === '/' || path === '') {
                // 直接返回 HTML 字符串，或者你可以把 HTML 放到 KV 中
                // 这里简单返回提示，实际使用时建议把 HTML 放在 public 目录或绑定到 KV
                return new Response(
                    `请访问 /index.html 查看页面，或将 HTML 内容直接放在这里返回。`,
                    {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    }
                );
            }

            // ============================================================
            // 404
            // ============================================================
            return jsonResponse({ error: 'Not found' }, 404);

        } catch (error) {
            console.error('API Error:', error);
            return jsonResponse({ error: error.message }, 500);
        }
    }
};

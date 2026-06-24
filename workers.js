// ============================================================
// 重庆旅游攻略 - Cloudflare Workers API
// 直接放在项目根目录，命名为 workers.js
// ============================================================

// 高德地图 API Key（请替换为你自己的）
const AMAP_KEY = 'YOUR_AMAP_KEY_HERE';

// CORS 头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * 统一响应封装
 */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

/**
 * 处理 OPTIONS 预检请求
 */
function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
}

/**
 * 主入口
 */
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // 处理 OPTIONS
        if (method === 'OPTIONS') {
            return handleOptions();
        }

        // 获取 D1 数据库实例
        const db = env.travel_data;

        try {
            // ============================================================
            // 1. 根路径：返回前端 HTML（或者你的静态页面）
            // ============================================================
            if (path === '/' || path === '') {
                // 如果你的前端是单独部署的，可以重定向或返回 HTML
                // 这里简单地返回一个 JSON 说明
                return jsonResponse({
                    message: '重庆旅游攻略 API 已启动',
                    endpoints: {
                        '/api/itinerary': 'GET - 获取所有行程',
                        '/api/itinerary/1': 'GET - 获取第1天行程',
                        '/api/itinerary/1': 'PUT - 更新第1天行程',
                        '/api/itinerary': 'POST - 新增行程',
                        '/api/itinerary/1': 'DELETE - 删除第1天行程',
                        '/api/amap-key': 'GET - 获取高德地图 Key',
                    }
                });
            }

            // ============================================================
            // 2. 高德地图 Key 接口
            // ============================================================
            if (path === '/api/amap-key') {
                return jsonResponse({ key: AMAP_KEY });
            }

            // ============================================================
            // 3. 行程 API 接口
            // ============================================================
            if (path.startsWith('/api/itinerary')) {
                // 提取天数参数，如 /api/itinerary/1 -> 1
                const parts = path.split('/');
                const dayParam = parts[parts.length - 1];
                const dayNumber = parseInt(dayParam);

                // ---- GET 请求 ----
                if (method === 'GET') {
                    // 如果指定了天数，查询当天的行程
                    if (!isNaN(dayNumber) && dayNumber > 0) {
                        const result = await db.prepare(
                            'SELECT * FROM itinerary WHERE day = ?'
                        ).bind(dayNumber).first();

                        if (!result) {
                            return jsonResponse({ error: `Day ${dayNumber} not found` }, 404);
                        }

                        // 解析 JSON 字段
                        if (result.schedule) result.schedule = JSON.parse(result.schedule);
                        if (result.places) result.places = JSON.parse(result.places);

                        return jsonResponse(result);
                    }

                    // 否则查询所有行程
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

                // ---- POST 请求：新增行程 ----
                if (method === 'POST') {
                    const body = await request.json();
                    const { day, title, subtitle, walk_badge, rest_note, lunch_recommendation, schedule, places } = body;

                    if (!day || !title) {
                        return jsonResponse({ error: 'day and title are required' }, 400);
                    }

                    const result = await db.prepare(
                        `INSERT INTO itinerary 
                         (day, title, subtitle, walk_badge, rest_note, lunch_recommendation, schedule, places) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(
                        day,
                        title,
                        subtitle || '',
                        walk_badge || '',
                        rest_note || '',
                        lunch_recommendation || '',
                        JSON.stringify(schedule || []),
                        JSON.stringify(places || [])
                    ).run();

                    return jsonResponse({
                        success: true,
                        id: result.meta.last_row_id,
                    }, 201);
                }

                // ---- PUT 请求：更新指定天的行程 ----
                if (method === 'PUT') {
                    if (isNaN(dayNumber) || dayNumber <= 0) {
                        return jsonResponse({ error: 'Invalid day parameter' }, 400);
                    }

                    const body = await request.json();
                    const { title, subtitle, walk_badge, rest_note, lunch_recommendation, schedule, places } = body;

                    // 检查是否存在
                    const existing = await db.prepare(
                        'SELECT id FROM itinerary WHERE day = ?'
                    ).bind(dayNumber).first();

                    if (!existing) {
                        return jsonResponse({ error: `Day ${dayNumber} not found` }, 404);
                    }

                    // 动态构建更新语句
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

                    // 返回更新后的数据
                    const updated = await db.prepare(
                        'SELECT * FROM itinerary WHERE day = ?'
                    ).bind(dayNumber).first();

                    if (updated.schedule) updated.schedule = JSON.parse(updated.schedule);
                    if (updated.places) updated.places = JSON.parse(updated.places);

                    return jsonResponse(updated);
                }

                // ---- DELETE 请求：删除指定天的行程 ----
                if (method === 'DELETE') {
                    if (isNaN(dayNumber) || dayNumber <= 0) {
                        return jsonResponse({ error: 'Invalid day parameter' }, 400);
                    }

                    const result = await db.prepare(
                        'DELETE FROM itinerary WHERE day = ?'
                    ).bind(dayNumber).run();

                    if (result.meta.changes === 0) {
                        return jsonResponse({ error: `Day ${dayNumber} not found` }, 404);
                    }

                    return jsonResponse({ success: true, deleted: dayNumber });
                }

                return jsonResponse({ error: 'Method not allowed' }, 405);
            }

            // ============================================================
            // 4. 404 - 未找到
            // ============================================================
            return jsonResponse({ error: 'Not found' }, 404);

        } catch (error) {
            console.error('API Error:', error);
            return jsonResponse({ error: error.message }, 500);
        }
    }
};

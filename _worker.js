// ============================================================
// 重庆-丰都旅游攻略 - Cloudflare Workers API
// ============================================================

// 图片仓库基础URL
const GITHUB_BASE = 'https://raw.githubusercontent.com/tuboshu5418/chongqing-travel-images/main';

// 高德导航URI前缀（不需要Key）
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

        // 处理 OPTIONS 预检请求
        if (method === 'OPTIONS') {
            return handleOptions();
        }

        const db = env['travel_data'];

        // ============================================================
        // 1. API 路由
        // ============================================================
        if (path.startsWith('/api/')) {

            // ---- 1.1 高德导航链接 ----
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

            // ---- 1.2 图片Base URL ----
            if (path === '/api/images/base') {
                return jsonResponse({
                    github: GITHUB_BASE,
                });
            }

            // ---- 1.3 行程API ----
            if (path.startsWith('/api/itinerary')) {
                const parts = path.split('/');
                const dayParam = parts[parts.length - 1];
                const dayNumber = parseInt(dayParam);

                // GET 请求
                if (method === 'GET') {
                    // 查询某一天
                    if (!isNaN(dayNumber) && dayNumber > 0) {
                        try {
                            const result = await db.prepare(
                                'SELECT * FROM itinerary WHERE day = ?'
                            ).bind(dayNumber).first();

                            if (!result) {
                                return jsonResponse({ error: `Day ${dayNumber} not found` }, 404);
                            }

                            if (result.schedule) result.schedule = JSON.parse(result.schedule);
                            if (result.places) result.places = JSON.parse(result.places);

                            return jsonResponse(result);
                        } catch (e) {
                            return jsonResponse({ error: '数据库查询失败: ' + e.message }, 500);
                        }
                    }

                    // 查询所有天
                    try {
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

                // PUT 更新
                if (method === 'PUT') {
                    if (isNaN(dayNumber) || dayNumber <= 0) {
                        return jsonResponse({ error: 'Invalid day parameter' }, 400);
                    }

                    try {
                        const body = await request.json();
                        const { title, subtitle, walk_badge, rest_note, breakfast, lunch, dinner, schedule, places } = body;

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
                        if (breakfast !== undefined) { updates.push('breakfast = ?'); values.push(breakfast); }
                        if (lunch !== undefined) { updates.push('lunch = ?'); values.push(lunch); }
                        if (dinner !== undefined) { updates.push('dinner = ?'); values.push(dinner); }
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
                    } catch (e) {
                        return jsonResponse({ error: '更新失败: ' + e.message }, 500);
                    }
                }

                return jsonResponse({ error: 'Method not allowed' }, 405);
            }

            // 其他 API 路由返回 404
            return jsonResponse({ error: 'API not found' }, 404);
        }

        // ============================================================
        // 2. 静态资源托管
        // ============================================================
        try {
            // 处理根路径
            let filePath = path;
            if (filePath === '/' || filePath === '') {
                filePath = '/index.html';
            }

            // 从 Pages 静态存储获取文件
            const asset = await env.ASSETS.fetch(
                new Request(new URL(filePath, request.url).toString(), request)
            );

            // 如果文件存在，直接返回
            if (asset.status === 200) {
                return asset;
            }
        } catch (e) {
            // 静态文件获取失败，继续执行
        }

        // ============================================================
        // 3. 404 - 未找到
        // ============================================================
        return new Response('Not Found', {
            status: 404,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });
    }
};

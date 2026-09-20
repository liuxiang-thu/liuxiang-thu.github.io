# 主页访客统计 Worker

这个 Worker 为 `https://liuxiang-thu.github.io` 提供两个接口：

- `POST /visit`：接收匿名浏览器 UUID，哈希后写入 D1；重复 UUID 不增加人数。
- `GET /stats`：返回 `{"uniqueVisitors": 123}`。

## Cloudflare 控制台部署

1. 在 Workers & Pages 中创建名为 `xiang-homepage-visitors` 的 Worker。
2. 将 `src/index.js` 的完整内容粘贴到 Worker 编辑器并部署。
3. 创建名为 `xiang-homepage-visitors` 的 D1 数据库。
4. 在 D1 控制台执行 `schema.sql` 中的 SQL。
5. 回到 Worker 的 Bindings，添加 D1 database binding，变量名必须是 `DB`。
6. 再部署一次，记录 Worker 的 `workers.dev` 地址。

也可以使用 Wrangler 部署。创建 D1 后，将数据库 ID 写入 `wrangler.jsonc`，执行远程建表并部署：

```bash
npx wrangler d1 execute xiang-homepage-visitors --remote --file schema.sql
npx wrangler deploy
```

不要在网页或仓库中放入 Cloudflare API Token。

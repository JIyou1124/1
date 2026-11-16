# 🚀 断线宇航局 3.0

宇宙主题的每日签到、趣味挑战、积分商店、排行榜原型。

## 本地运行
Node.js 18 或更新版本：`node server.js`；打开 `http://localhost:3000`。

无须安装依赖。游客模式可测试全部主要玩法。

## Render 网页服务
- 仓库：`JIyou1124/1`
- Runtime: Node
- Build command: `echo no-build`
- Start command: `node server.js`
- Plan: Free（若 Render 要求绑定付款方式，请自行决定是否添加卡）
- 服务器自动读取 `PORT` 环境变量。

## 微信网页授权（目前尚未启用）
需要可使用网页授权的公众号、已配置的业务域名及 OAuth 回调地址，配置以下环境变量：

```
SITE_URL=https://实际生成的域名
WECHAT_APP_ID=公众号AppID
WECHAT_APP_SECRET=公众号AppSecret
```

回调地址是 `https://实际生成的域名/auth/callback`。将密钥保存在 Render 环境变量，**绝不可直接提交到 GitHub**。微信昵称头像由用户本人授权后获取，不支持未经授权读取微信群成员信息。

## ⚠️ 原型限制
- 目前记录写入运行容器中的 `data.json`，Render 免费实例重启/重新部署后**可能清空所有签到、积分、排行记录**。
- 生产环境必须换成托管 PostgreSQL 等持久化数据库，然后才适合多人长期使用。
- 游客体验为随机临时身份，支持主动退出。演示与正式用途应分开。
- 排行榜仅包含未关闭公开展示的账户。
- 挑战卡采用非露骨的趣味文案和 emoji，非真人或露骨图片。
- 请勿将现有版本作为稳定生产网站使用。

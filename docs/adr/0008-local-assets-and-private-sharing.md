# Local assets and private sharing

应用不加载远程脚本、分析服务、字体或自动抓取的网站资源，所有运行时依赖随静态构建物发布并受严格 CSP 限制。Share Package 以独立分享口令加密完整 Linkmark Package（包括原本可明文保存的 Target 元数据），确保泄露分享字符串不泄露可读目录或秘密。

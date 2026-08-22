# Security-biased PWA updates

应用可安装并离线运行，但每次启动检查同源静态构建物更新，发现新版本即提示重新加载；安全更新可要求刷新。Service Worker 只缓存构建期同源资源，绝不缓存、代理或上传用户数据。

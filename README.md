# Cindy & friends — Team Pack

一个用交互式 3D 卡包介绍 Muses、Hermes、Ruby 和 Hecate 的团队页面。

[打开在线 Demo](https://zzhuangxd.github.io/cindy-team-packs/)

## 体验

- 拖动立体卡包，查看正面、背面、袋身鼓起的厚度和封边。
- 向右拖动下方封口滑块，或沿模型顶部封口向右划开。也可点击「直接拆开」。
- 撕下的封边飞开，四张成员卡从袋中升起、展开。
- 点击 3D 卡片或成员名字，拖动查看卡片，翻面阅读介绍。
- 支持重新开包、上下成员切换、键盘操作、可选合成音效和减少动画偏好。
- 手机支持手指旋转、撕封口、选择和翻卡；页面允许自然纵向滚动。
- WebGL 无法使用时，保留头像、成员资料、成员切换和正反面内容的简化浏览入口。

## 卡面

使用这四位伙伴的现有头像，原创设计卡面和卡背：

| 成员 | 身份与职责 | 卡面元素 |
| --- | --- | --- |
| Muses | 绘画与视觉创作 | 珊瑚色笔触、抽象图形、艺术印章 |
| Hermes | 文档架构与知识组织 | 叠放的纸页、信息线条、鼠尾草绿 |
| Ruby | 只会喵喵叫的阿比西尼亚小公主 | 小王冠、爪印、玫瑰色花边 |
| Hecate | 交互原型与工程实现 | 轨道、节点、紫色与青柠点缀 |

## 实现

Three.js 实时渲染参数化的封闭袋体网格、锯齿封边、压封纹与金属反射。顶部封口独立建模，开包时袋口形变，成员卡经过提升、展开、检视和翻面几个状态。开包过程不依赖预渲染视频。

卡片有独立正反面纹理与倒角厚度。头像、卡面文字、图形都在本地生成纹理，页面不依赖外部字体、图床或运行时后端。四张头像总计约 810 KB。

## 开发与验证

需要 Node.js 22.12+ 或 24。

```sh
npm ci
npm run dev
npm run build
npm test
```

`npm run build` 将部署文件输出到 `docs/`；GitHub Pages 使用 `main /docs`。

浏览器验收脚本：

```sh
npm run test:browser
npx playwright install webkit
npm run test:webkit
```

Chrome 验收默认使用 macOS 的 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`。WebKit 验收使用 Playwright 安装的浏览器。可以通过 `DEMO_URL` 指向线上站点。

验收覆盖桌面、390×844 手机、320×568 窄屏、844×390 横屏、WebKit 手机视口和减少动画偏好。脚本检查真实鼠标/触摸拖动、拆封中断复位、展开、3D 卡片选择、翻面、四位成员、重新开包、键盘操作、图片请求和横向溢出。

浏览器手机视口模拟不等同于全部实体手机实测。

## 来源与授权

卡包交互参考 [Raspberry Studio 的 Team 区域](https://raspberrytokyo.com/)。页面代码、袋体模型、卡面与动画由本项目实现；未使用参考站的代码、模型、图片或开包视频。

代码使用 MIT License。四张伙伴头像沿用用户指定的现有形象，其权利归原权利人，不包含在本项目代码的 MIT 授权中。依赖许可保留在 `public/licenses/`。

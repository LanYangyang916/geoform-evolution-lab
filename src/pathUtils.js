// 统一路径前缀：适配 GitHub Pages 子路径 /geoform-evolution-lab/
// 本地开发时 Vite 自动置为 "/"，部署时置为 "/geoform-evolution-lab/"
export const BASE = import.meta.env.BASE_URL;

/**
 * 给相对或绝对项目资源路径拼接 BASE 前缀。
 * 用法：import { asset } from "./pathUtils.js"
 *       loader.load(asset("models/river/v-valley.glb"))
 * 传入路径不要以斜杠开头。
 */
export function asset(p) {
  return BASE + p;
}

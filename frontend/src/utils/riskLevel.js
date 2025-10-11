/**
 * 风险等级计算工具
 * 与数据库 compute_risk_profile 函数保持完全一致
 */

/**
 * 计算风险等级文本
 * @param {number} score - 风险评分 (0-1)
 * @returns {string} 风险等级文本
 */
export const getRiskLevelText = (score) => {
  if (score >= 0.70) return '高风险'   // high -> 高风险
  if (score >= 0.45) return '中风险'   // medium -> 中风险
  if (score >= 0.25) return '低风险'   // low -> 低风险
  return '很健康'                       // <25% -> 很健康
}

/**
 * 获取风险等级对应的 Element Plus 标签类型
 * @param {number} score - 风险评分 (0-1)
 * @returns {string} Element Plus 标签类型
 */
export const getRiskTagType = (score) => {
  if (score >= 0.70) return 'danger'    // 高风险 - 红色
  if (score >= 0.45) return 'warning'  // 中风险 - 橙色
  if (score >= 0.25) return 'primary'  // 低风险 - 蓝色
  return 'success'                    // 很健康 - 绿色
}

/**
 * 获取风险等级对应的颜色
 * @param {number} score - 风险评分 (0-1)
 * @returns {string} 十六进制颜色值
 */
export const getRiskColor = (score) => {
  if (score >= 0.70) return '#F56C6C'   // 高风险 - 红色
  if (score >= 0.45) return '#E6A23C'   // 中风险 - 橙色
  if (score >= 0.25) return '#409EFF'   // 低风险 - 蓝色
  return '#67C23A'                     // 很健康 - 绿色
}

/**
 * 获取风险等级的详细描述
 * @param {number} score - 风险评分 (0-1)
 * @returns {string} 风险描述
 */
export const getRiskDescription = (score) => {
  const scorePercent = Math.round(score * 100)
  if (score < 0.25) {
    return '患者整体状况良好，各项指标基本正常，建议定期体检。'
  } else if (score < 0.45) {
    return '患者健康状况良好，存在轻微异常，建议保持关注，定期复查。'
  } else if (score < 0.70) {
    return '患者存在一定风险，需要密切关注异常指标，建议进一步检查和干预。'
  } else {
    return '患者风险较高，建议立即采取医疗干预措施，密切监测病情变化。'
  }
}

/**
 * 仪表盘颜色分区配置
 * @returns {Array} ECharts 仪表盘颜色配置
 */
export const getGaugeColors = () => [
  [0.25, '#67C23A'],   // 很健康 - 绿色 (0-25%)
  [0.45, '#409EFF'],   // 低风险 - 蓝色 (25-45%)
  [0.70, '#E6A23C'],   // 中风险 - 橙色 (45-70%)
  [1, '#F56C6C']       // 高风险 - 红色 (70-100%)
]

/**
 * 风险等级常量
 */
export const RISK_LEVELS = {
  VERY_HEALTHY: { threshold: 0.25, text: '很健康', color: '#67C23A', tagType: 'success' },
  LOW_RISK: { threshold: 0.45, text: '低风险', color: '#409EFF', tagType: 'primary' },
  MEDIUM_RISK: { threshold: 0.70, text: '中风险', color: '#E6A23C', tagType: 'warning' },
  HIGH_RISK: { threshold: 1.00, text: '高风险', color: '#F56C6C', tagType: 'danger' }
}
/**
 * 数据库端智能分析 API
 * 调用 PL/pgSQL 存储过程实现的多模态分析功能
 */

import api from '@/utils/api'

/**
 * 获取患者多模态数据（统一查询）
 * @param {number} patientId - 患者ID
 * @returns {Promise} 多模态数据（病历、CT、实验室指标）
 */
export const getMultimodalData = (patientId) => {
  return api.get(`/db-analysis/multimodal/${patientId}`)
}

/**
 * 提取关键诊断证据
 * @param {number} patientId - 患者ID
 * @returns {Promise} 证据列表（包含模态、来源、权重等）
 */
export const extractKeyEvidence = (patientId) => {
  return api.get(`/db-analysis/evidence/${patientId}`)
}

/**
 * 检测实验室指标异常（Z-score 算法）
 * @param {number} patientId - 患者ID
 * @returns {Promise} 异常指标列表
 */
export const detectLabAnomalies = (patientId) => {
  return api.get(`/db-analysis/anomalies/${patientId}`)
}

/**
 * 智能诊断（核心功能）
 * 数据库端 AI 分析，融合多模态数据生成诊断结论
 * @param {number} patientId - 患者ID
 * @returns {Promise} 诊断结果（包含诊断、证据、建议等）
 */
export const smartDiagnosis = (patientId) => {
  return api.post('/db-analysis/smart-diagnosis', { patient_id: patientId })
}

/**
 * 查询多模态视图
 * @param {Object} params - 查询参数
 * @param {number} params.patient_id - 患者ID（可选）
 * @param {number} params.limit - 每页数量
 * @param {number} params.offset - 偏移量
 * @returns {Promise} 视图数据
 */
export const getMultimodalView = (params = {}) => {
  return api.get('/db-analysis/view/multimodal', { params })
}

/**
 * 综合分析（一次获取所有分析结果）
 * 并行调用多个存储过程，返回完整分析报告
 * @param {number} patientId - 患者ID
 * @returns {Promise} 综合分析结果
 */
export const comprehensiveAnalysis = (patientId) => {
  return api.get(`/db-analysis/comprehensive/${patientId}`)
}

export default {
  getMultimodalData,
  extractKeyEvidence,
  detectLabAnomalies,
  smartDiagnosis,
  getMultimodalView,
  comprehensiveAnalysis
}

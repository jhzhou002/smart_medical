/**
 * 数据库端智能分析 API
 * 调用 PL/pgSQL 存储过程实现的多模态分析功能
 */

import api from '@/utils/api'

/**
 * 获取患者多模态数据（统一查询）
 */
export const getMultimodalData = (patientId) => api.get(`/db-analysis/multimodal/${patientId}`)

/**
 * 提取关键诊断证据
 */
export const extractKeyEvidence = (patientId) => api.get(`/db-analysis/evidence/${patientId}`)

/**
 * 检测实验室指标异常（Z-score 算法）
 */
export const detectLabAnomalies = (patientId) => api.get(`/db-analysis/anomalies/${patientId}`)

/**
 * 智能诊断（数据库端）
 */
export const smartDiagnosis = (patientId) => api.post('/db-analysis/smart-diagnosis', { patient_id: patientId })

/**
 * 多模态视图查询
 */
export const getMultimodalView = (params = {}) => api.get('/db-analysis/view/multimodal', { params })

/**
 * 综合分析（一次聚合返回所有结果）
 */
export const comprehensiveAnalysis = (patientId) => api.get(`/db-analysis/comprehensive/${patientId}`)

/**
 * 导出 FHIR Bundle
 */
export const exportFHIR = (patientId) => api.get(`/db-analysis/fhir/${patientId}`)

/**
 * 置信度校准
 */
export const calibrateConfidence = (payload) => api.post('/db-analysis/calibration', payload)

export default {
  getMultimodalData,
  extractKeyEvidence,
  detectLabAnomalies,
  smartDiagnosis,
  getMultimodalView,
  comprehensiveAnalysis,
  exportFHIR,
  calibrateConfidence
}

/**
 * AI 分析状态
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { textAnalysisAPI, ctAnalysisAPI, labAnalysisAPI, diagnosisAPI } from '@/utils/request'
import { ElMessage } from 'element-plus'

export const useAnalysisStore = defineStore('analysis', () => {
  // 状态
  const textAnalysis = ref(null)      // 病历分析结果
  const ctAnalysis = ref(null)        // CT 分析结果
  const labAnalysis = ref(null)       // 实验室指标分析结果
  const diagnosis = ref(null)         // 综合诊断结果
  const loading = ref({
    text: false,
    ct: false,
    lab: false,
    diagnosis: false
  })

  // 方法

  /**
   * 上传并分析病历文本图片
   */
  const uploadAndAnalyzeText = async (file, patientId) => {
    loading.value.text = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('patient_id', patientId)

      const res = await textAnalysisAPI.upload(formData)

      if (res.data) {
        textAnalysis.value = res.data
        ElMessage.success('病历分析完成')
        return res.data
      }
    } catch (error) {
      ElMessage.error('病历分析失败')
      console.error(error)
      throw error
    } finally {
      loading.value.text = false
    }
  }

  /**
   * 上传并分析 CT 影像
   */
  const uploadAndAnalyzeCT = async (file, patientId, bodyPart = 'lung') => {
    loading.value.ct = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('patient_id', patientId)
      formData.append('body_part', bodyPart)

      const res = await ctAnalysisAPI.upload(formData)

      if (res.data) {
        ctAnalysis.value = res.data
        ElMessage.success('CT 分析完成')
        return res.data
      }
    } catch (error) {
      ElMessage.error('CT 分析失败')
      console.error(error)
      throw error
    } finally {
      loading.value.ct = false
    }
  }

  /**
   * 上传并分析实验室指标图片
   */
  const uploadAndAnalyzeLab = async (file, patientId) => {
    loading.value.lab = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('patient_id', patientId)

      const res = await labAnalysisAPI.upload(formData)

      if (res.data) {
        labAnalysis.value = res.data
        ElMessage.success('实验室指标分析完成')
        return res.data
      }
    } catch (error) {
      ElMessage.error('实验室指标分析失败')
      console.error(error)
      throw error
    } finally {
      loading.value.lab = false
    }
  }

  /**
   * 生成综合诊断
   */
  const generateDiagnosis = async (patientId) => {
    loading.value.diagnosis = true
    try {
      const res = await diagnosisAPI.generate(patientId)

      if (res.data) {
        diagnosis.value = res.data
        ElMessage.success('综合诊断生成完成')
        return res.data
      }
    } catch (error) {
      ElMessage.error('生成综合诊断失败')
      console.error(error)
      throw error
    } finally {
      loading.value.diagnosis = false
    }
  }

  /**
   * 重置分析结果
   */
  const resetAnalysis = () => {
    textAnalysis.value = null
    ctAnalysis.value = null
    labAnalysis.value = null
    diagnosis.value = null
  }

  return {
    textAnalysis,
    ctAnalysis,
    labAnalysis,
    diagnosis,
    loading,
    uploadAndAnalyzeText,
    uploadAndAnalyzeCT,
    uploadAndAnalyzeLab,
    generateDiagnosis,
    resetAnalysis
  }
})

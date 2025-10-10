/**
 * PDF 导出工具
 * 用于生成医疗分析报告 PDF (紧凑单页 A4 格式)
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { createApp, h } from 'vue'
import PDFReportTemplateV2 from '@/components/PDFReportTemplateV2.vue'

/**
 * 导出智能诊断报告为 PDF (A4 格式，支持动态加权)
 * @param {Object} patient - 患者信息
 * @param {Object} comprehensiveData - 综合诊断数据（来自 /api/db-analysis/comprehensive）
 *   - comprehensiveData.diagnosis: 诊断数据对象
 *   - comprehensiveData.multimodal: 多模态数据
 *   - comprehensiveData.anomalies: 异常检测
 */
export async function exportAnalysisReport(patient, comprehensiveData) {
  // 提取诊断数据
  const diagnosisData = comprehensiveData.diagnosis || {};

  // 调试：输出数据结构
  console.log('=== PDF Export Data ===')
  console.log('Patient:', patient)
  console.log('Comprehensive Data:', comprehensiveData)
  console.log('Diagnosis Data:', diagnosisData)
  console.log('Multimodal Data:', comprehensiveData.multimodal)
  console.log('Text Data:', comprehensiveData.multimodal?.text_data)
  console.log('CT Data:', comprehensiveData.multimodal?.ct_data)
  console.log('Lab Data:', comprehensiveData.multimodal?.lab_data)

  let tempContainer = null
  let app = null

  try {
    // 创建临时容器用于渲染 PDF 模板
    tempContainer = document.createElement('div')
    tempContainer.style.position = 'fixed'
    tempContainer.style.top = '0'
    tempContainer.style.left = '-9999px' // 移出视窗而不是使用visibility
    tempContainer.style.zIndex = '-9999'
    tempContainer.style.width = '794px'
    tempContainer.style.minHeight = '1123px'
    tempContainer.style.overflow = 'visible'
    tempContainer.style.background = 'white'
    document.body.appendChild(tempContainer)

    console.log('临时容器已创建')

    // 创建 Vue 应用实例并挂载 PDF 模板组件
    app = createApp({
      render() {
        return h(PDFReportTemplateV2, {
          patient,
          diagnosisData,
          comprehensiveData
        })
      }
    })

    app.mount(tempContainer)

    // 等待 DOM 渲染完成
    await new Promise(resolve => setTimeout(resolve, 300))

    const element = tempContainer.querySelector('#pdf-report-template-v2')

    if (!element) {
      throw new Error('未找到 PDF 报告模板元素')
    }

    console.log('PDF模板数据:', { patient, diagnosisData })
    console.log('Element dimensions:', {
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      offsetWidth: element.offsetWidth,
      offsetHeight: element.offsetHeight,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      innerHTML: element.innerHTML.substring(0, 200) // 打印部分HTML内容
    })

    // 等待图片加载（如果有CT图片）
    if (diagnosisData?.evidence_detail?.ct?.ct_url) {
      console.log('等待CT图片加载:', diagnosisData.evidence_detail.ct.ct_url)
      const images = element.querySelectorAll('img')
      const imageLoadPromises = Array.from(images).map(img => {
        return new Promise((resolve) => {
          if (img.complete) {
            console.log('图片已加载:', img.src)
            resolve()
          } else {
            img.onload = () => {
              console.log('图片加载完成:', img.src)
              resolve()
            }
            img.onerror = () => {
              console.error('图片加载失败:', img.src)
              resolve() // 继续执行，不阻塞
            }
            // 超时保护
            setTimeout(resolve, 3000)
          }
        })
      })
      await Promise.all(imageLoadPromises)
    }

    // 再等待一下确保渲染完成
    await new Promise(resolve => setTimeout(resolve, 300))

    // 获取所有section的位置信息，用于智能分页
    const sections = element.querySelectorAll('[data-page-section]')
    const sectionPositions = Array.from(sections).map(section => ({
      name: section.dataset.pageSection,
      offsetTop: section.offsetTop,
      offsetHeight: section.offsetHeight,
      bottom: section.offsetTop + section.offsetHeight
    }))

    console.log('内容区块位置信息:', sectionPositions)

    // 使用 html2canvas 将 HTML 转为高清图片
    console.log('开始使用html2canvas转换...')
    const canvas = await html2canvas(element, {
      scale: 2, // 提高清晰度 (2倍分辨率)
      useCORS: true, // 允许跨域图片
      logging: true, // 开启日志以便调试
      backgroundColor: '#ffffff', // 白色背景
      allowTaint: false, // 禁止污染画布，与useCORS配合
      foreignObjectRendering: false,
      imageTimeout: 15000, // 图片加载超时时间
      onclone: (clonedDoc) => {
        console.log('html2canvas克隆文档完成')
      }
    })

    console.log('Canvas生成完成:', {
      width: canvas.width,
      height: canvas.height,
      isEmpty: canvas.width === 0 || canvas.height === 0
    })

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('生成的Canvas为空，请检查模板内容')
    }

    // A4 纸张尺寸 (mm)
    const a4Width = 210
    const a4Height = 297

    // 创建 PDF 文档
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    })

    // 将Canvas转换为图片数据
    const imgData = canvas.toDataURL('image/jpeg', 0.95)

    // 计算图片在 PDF 中的尺寸
    // 直接按宽度铺满整个A4（模板宽度794px对应A4宽度210mm）
    const imgWidth = a4Width
    const imgHeight = (canvas.height * a4Width) / canvas.width

    console.log('PDF图片尺寸计算:', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      a4Width,
      a4Height,
      imgWidth,
      imgHeight,
      willFitInOnePage: imgHeight <= a4Height,
      pagesNeeded: Math.ceil(imgHeight / a4Height)
    })

    // 智能分页：基于内容区块位置
    if (imgHeight > a4Height) {
      let currentY = 0
      let pageCount = 0
      const minPageContent = 80 // 每页最少内容80mm

      // 计算智能分页点
      const calculatePageBreaks = () => {
        const breaks = []
        let tentativeBreak = a4Height
        const minSectionSpace = 40 // 页面底部至少需要40mm才能放section，否则移到下一页

        while (tentativeBreak < imgHeight) {
          let bestBreak = tentativeBreak
          let foundSectionBoundary = false

          // 检查是否有section被当前分页点切断
          for (const section of sectionPositions) {
            const sectionTopMm = (section.offsetTop / element.offsetHeight) * imgHeight
            const sectionBottomMm = (section.bottom / element.offsetHeight) * imgHeight
            const sectionHeightMm = sectionBottomMm - sectionTopMm

            // 情况1: section在分页点附近开始，但底部空间不足
            const spaceBeforeBreak = tentativeBreak - sectionTopMm
            if (sectionTopMm <= tentativeBreak &&
                sectionBottomMm > tentativeBreak &&
                spaceBeforeBreak < minSectionSpace) {
              // 空间不足，将整个section移到下一页
              bestBreak = sectionTopMm
              foundSectionBoundary = true
              console.log(`Section "${section.name}" 底部空间不足(${spaceBeforeBreak.toFixed(1)}mm)，移到下一页`)
              break
            }

            // 情况2: section刚好跨越分页点
            if (sectionTopMm < tentativeBreak && sectionBottomMm > tentativeBreak) {
              // 优先在section开始处分页
              if (tentativeBreak - sectionTopMm > minSectionSpace) {
                bestBreak = sectionTopMm
                foundSectionBoundary = true
                console.log(`Section "${section.name}" 跨越分页点，在其开始处分页`)
                break
              }
            }
          }

          // 如果没有找到需要调整的section，在附近寻找最佳section边界
          if (!foundSectionBoundary) {
            let minDistance = Infinity
            const searchRange = 30

            for (const section of sectionPositions) {
              const sectionTopMm = (section.offsetTop / element.offsetHeight) * imgHeight

              if (sectionTopMm >= tentativeBreak - searchRange &&
                  sectionTopMm <= tentativeBreak + searchRange) {
                const distance = Math.abs(sectionTopMm - tentativeBreak)
                if (distance < minDistance) {
                  minDistance = distance
                  bestBreak = sectionTopMm
                  foundSectionBoundary = true
                }
              }
            }
          }

          // 确保分页点合理
          const lastBreak = breaks.length > 0 ? breaks[breaks.length - 1] : 0
          if (bestBreak - lastBreak >= minPageContent) {
            breaks.push(bestBreak)
            tentativeBreak = bestBreak + a4Height
          } else {
            // 使用默认位置
            breaks.push(tentativeBreak)
            tentativeBreak += a4Height
          }
        }

        return breaks
      }

      const pageBreaks = calculatePageBreaks()
      console.log('智能分页点 (mm):', pageBreaks)

      while (currentY < imgHeight) {
        if (pageCount > 0) {
          pdf.addPage()
        }

        // 确定当前页高度
        const remainingHeight = imgHeight - currentY
        let pageHeight

        if (pageCount < pageBreaks.length) {
          // 使用智能分页点
          pageHeight = pageBreaks[pageCount] - currentY
        } else {
          // 最后一页，显示剩余所有内容
          pageHeight = remainingHeight
        }

        // 计算在canvas上的裁剪位置
        const srcY = (currentY / imgHeight) * canvas.height
        const srcHeight = (pageHeight / imgHeight) * canvas.height

        // 裁剪canvas
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = srcHeight
        const pageCtx = pageCanvas.getContext('2d')

        pageCtx.drawImage(
          canvas,
          0, srcY, canvas.width, srcHeight,
          0, 0, canvas.width, srcHeight
        )

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95)
        pdf.addImage(pageImgData, 'JPEG', 0, 0, imgWidth, pageHeight, undefined, 'FAST')

        console.log(`第 ${pageCount + 1} 页:`, {
          currentY: currentY.toFixed(1),
          pageHeight: pageHeight.toFixed(1),
          isLastPage: pageCount >= pageBreaks.length
        })

        currentY += pageHeight
        pageCount++

        if (pageCount > 10) {
          console.warn('分页超过10页，强制停止')
          break
        }
      }

      console.log(`PDF生成完成，共 ${pageCount} 页`)
    } else {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST')
      console.log('PDF生成完成，共 1 页')
    }

    // 保存 PDF（文件名格式：患者名_医疗分析报告_2025-1-4.pdf）
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
    const fileName = `${patient.name}_医疗分析报告_${dateStr}.pdf`
    pdf.save(fileName)

    // 清理临时容器
    app.unmount()
    document.body.removeChild(tempContainer)

    return {
      success: true,
      fileName
    }
  } catch (error) {
    console.error('PDF 导出失败:', error)

    // 清理临时容器
    if (app) {
      app.unmount()
    }
    if (tempContainer && document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer)
    }

    throw new Error(`PDF 导出失败: ${error.message}`)
  }
}

/**
 * 简化版 PDF 导出 (仅截图方式)
 * @param {String} elementId - 要导出的元素 ID
 * @param {String} fileName - 文件名
 */
export async function exportSimplePDF(elementId, fileName = 'report.pdf') {
  try {
    const element = document.getElementById(elementId)
    if (!element) {
      throw new Error(`未找到元素: ${elementId}`)
    }

    // 将元素转为 canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })

    // 创建 PDF
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
      compress: true
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
    pdf.save(fileName)

    return { success: true, fileName }
  } catch (error) {
    console.error('PDF 导出失败:', error)
    throw error
  }
}

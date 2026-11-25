import { describe, expect, it } from 'vitest'
import { translateValidationMessage, validationText } from '../src/lib/validation-message'

describe('backend validation messages', () => {
  it('translates class-validator messages to Vietnamese', () => {
    expect(translateValidationMessage('weightKg must not be greater than 500')).toBe(
      '«Cân nặng» không được lớn hơn 500.',
    )
    expect(translateValidationMessage('visceralFatLevel must be an integer number')).toBe(
      '«Mỡ nội tạng» phải là số nguyên.',
    )
    expect(translateValidationMessage('Something else')).toBe('Something else')
  })

  it('folds unknown fields into one sentence about an outdated backend', () => {
    expect(
      validationText([
        'property skeletalMuscleMassKg should not exist',
        'property segmentalLean should not exist',
        'heightCm must not be less than 1',
      ]),
    ).toBe(
      'Máy chủ chưa hỗ trợ «Cơ xương (SMM)», «Cơ nạc 5 vùng». Backend đang chạy bản cũ, cần cập nhật bản InBody mới. «Chiều cao» không được nhỏ hơn 1.',
    )
    expect(validationText('property skeletalMuscleMassKg should not exist')).toMatch(
      /^Máy chủ chưa hỗ trợ trường «Cơ xương \(SMM\)»/,
    )
  })
})

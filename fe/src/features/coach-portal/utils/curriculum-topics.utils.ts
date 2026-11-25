import type { ExerciseKnowledgeItem } from '../types/coach-portal.types';
import { getExerciseDiscipline } from './exercise-metadata.utils';

export interface NormalizedCurriculumTopic {
  topicNumber: number;
  name: string;
  description: string;
  benefits?: string;
  intensity?: string;
}

export function extractTopicsFromPlan(plan: any): NormalizedCurriculumTopic[] {
  if (!plan) return [];
  let raw = plan.curriculumTopics;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {}
  }

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((item: any, idx: number) => {
      if (typeof item === 'string') {
        const parts = item.split(':');
        const title = parts.length > 1 ? parts.slice(1).join(':').trim() : item;
        return {
          topicNumber: idx + 1,
          name: title,
          description: item,
          benefits: '',
          intensity: 'Tiêu chuẩn',
        };
      }
      return {
        topicNumber: item.topicNumber || idx + 1,
        name: item.name || `Chuyên đề ${idx + 1}`,
        description: item.description || '',
        benefits: item.benefits || '',
        intensity: item.intensity || 'Tiêu chuẩn',
      };
    });
  }

  const name = (plan.name || '').toLowerCase();
  if (name.includes('trị liệu') || name.includes('cột sống') || name.includes('cổ vai gáy')) {
    return [
      {
        topicNumber: 1,
        name: 'Đánh giá cơ xương khớp & Giải tỏa căng cứng vùng cổ vai gáy',
        description: 'Buổi 1–3: Đánh giá cơ xương khớp & Giải tỏa căng cứng vùng cổ vai gáy',
        intensity: 'Nhẹ nhàng',
      },
      {
        topicNumber: 2,
        name: 'Kéo giãn cột sống & Phục hồi đĩa đệm lưng dưới',
        description: 'Buổi 4–6: Kéo giãn cột sống & Phục hồi đĩa đệm lưng dưới',
        intensity: 'Tiêu chuẩn',
      },
      {
        topicNumber: 3,
        name: 'Tăng cường sức mạnh cơ lõi (Core & Glutes)',
        description: 'Buổi 7–9: Tăng cường sức mạnh cơ lõi bảo vệ cột sống',
        intensity: 'Tiêu chuẩn',
      },
      {
        topicNumber: 4,
        name: 'Thư giãn hệ thần kinh & Nắn chỉnh tư thế toàn diện',
        description: 'Buổi 10–12: Thư giãn hệ thần kinh & Nắn chỉnh tư thế toàn diện',
        intensity: 'Phục hồi',
      },
    ];
  }
  if (name.includes('dưỡng sinh') || name.includes('thiền')) {
    return [
      {
        topicNumber: 1,
        name: 'Thanh lọc khí thở Pranayama & Đả thông kinh lạc',
        description: 'Buổi 1–3: Kỹ thuật thở sâu Pranayama & Thư giãn tinh thần',
        intensity: 'Nhẹ nhàng',
      },
      {
        topicNumber: 2,
        name: 'Yin Yoga dưỡng khớp & Giãn cơ sâu',
        description: 'Buổi 4–6: Kéo giãn chậm và sâu các nhóm cơ gân kheo',
        intensity: 'Nhẹ nhàng',
      },
      {
        topicNumber: 3,
        name: 'Thiền định tĩnh tâm & Cân bằng năng lượng luân xa',
        description: 'Buổi 7–9: Định tâm và xoa dịu áp lực tâm lý',
        intensity: 'Phục hồi',
      },
    ];
  }
  if (name.includes('box') || name.includes('kick')) {
    return [
      {
        topicNumber: 1,
        name: 'Bộ pháp di chuyển & Đòn đấm thẳng Jab - Cross',
        description: 'Buổi 1–3: Căn bản bộ pháp chân và kiểm soát cự ly',
        intensity: 'Trung bình',
      },
      {
        topicNumber: 2,
        name: 'Tổ hợp đòn Hook - Uppercut & Đỡ gạt né tránh',
        description: 'Buổi 4–6: Tấn công góc hẹp và phòng thủ cơ bản',
        intensity: 'Nâng cao',
      },
      {
        topicNumber: 3,
        name: 'Phản xạ đòn tay & Đấu tập Sparring có kiểm soát',
        description: 'Buổi 7–9: Đấu tập tình huống và phản xạ tốc độ',
        intensity: 'Cường độ cao',
      },
    ];
  }

  return [
    {
      topicNumber: 1,
      name: 'Nền tảng vận động chức năng & Khởi động chuẩn',
      description: 'Buổi 1–3: Nền tảng tư thế và hô hấp vận động',
      intensity: 'Tiêu chuẩn',
    },
    {
      topicNumber: 2,
      name: 'Phát triển sức bền & Phối hợp nhóm cơ chính',
      description: 'Buổi 4–6: Nâng cao thể lực và sức bền cơ bắp',
      intensity: 'Nâng cao',
    },
  ];
}

export function getRecommendedExercisesForTopic<T extends Pick<ExerciseKnowledgeItem, 'id' | 'title' | 'category' | 'instructions'>>(
  topicName: string,
  exercises: T[],
  discipline: string,
): T[] {
  const t = topicName.toLowerCase();
  const d = discipline.toUpperCase();

  const matched = exercises.filter((ex) => {
    const exTitle = ex.title.toLowerCase();
    const exCat = (ex.category || '').toLowerCase();
    const exDisc = getExerciseDiscipline(ex as any);

    if (d && d !== 'ALL' && exDisc !== d) return false;

    if (d === 'YOGA') {
      if (
        t.includes('cổ vai gáy') ||
        (t.includes('cơ xương khớp') && !t.includes('lõi')) ||
        t.includes('giải tỏa căng cứng')
      ) {
        return (
          exTitle.includes('cổ') ||
          exTitle.includes('vai gáy') ||
          exTitle.includes('mèo') ||
          exTitle.includes('xỏ kim') ||
          exTitle.includes('đại bàng') ||
          exTitle.includes('nhân sư') ||
          exTitle.includes('em bé') ||
          exTitle.includes('núi') ||
          exTitle.includes('thở bụng') ||
          exCat.includes('recovery')
        );
      }
      if (
        t.includes('thắt lưng') ||
        t.includes('đĩa đệm') ||
        t.includes('thoái hóa') ||
        (t.includes('cột sống') && !t.includes('cơ lõi') && !t.includes('khung'))
      ) {
        return (
          exTitle.includes('rắn hổ mang') ||
          exTitle.includes('cây cầu') ||
          exTitle.includes('chó úp mặt') ||
          exTitle.includes('xoay người nằm') ||
          exTitle.includes('xoay người ngồi') ||
          exTitle.includes('chim – chó') ||
          exTitle.includes('châu chấu') ||
          exTitle.includes('nhân sư') ||
          exTitle.includes('gác chân') ||
          exCat.includes('backbends')
        );
      }
      if (t.includes('cơ lõi') || t.includes('khung chậu') || t.includes('xương chậu') || t.includes('core')) {
        return (
          exTitle.includes('chim – chó') ||
          exTitle.includes('con thuyền') ||
          exTitle.includes('plank') ||
          exTitle.includes('cây cầu') ||
          exTitle.includes('khung chậu') ||
          exTitle.includes('pelvic') ||
          exTitle.includes('malasana') ||
          exTitle.includes('châu chấu') ||
          exTitle.includes('lunge thấp') ||
          exTitle.includes('bồ câu') ||
          exCat.includes('core')
        );
      }
      if (t.includes('tư thế chuẩn') || t.includes('chuẩn tự nhiên') || t.includes('tại nhà') || t.includes('duy trì linh hoạt')) {
        return (
          exTitle.includes('núi') ||
          exTitle.includes('cây') ||
          exTitle.includes('chiến binh') ||
          exTitle.includes('tam giác') ||
          exTitle.includes('em bé') ||
          exTitle.includes('mèo') ||
          exTitle.includes('savasana') ||
          exTitle.includes('thở bụng') ||
          exCat.includes('standing')
        );
      }
      if (t.includes('trị liệu') || t.includes('cột sống') || t.includes('phục hồi')) {
        return (
          exCat.includes('backbends') ||
          exCat.includes('recovery') ||
          exTitle.includes('rắn hổ mang') ||
          exTitle.includes('cột sống') ||
          exTitle.includes('cây cầu') ||
          exTitle.includes('em bé') ||
          exTitle.includes('xoay') ||
          exTitle.includes('xỏ kim') ||
          exTitle.includes('chim – chó') ||
          exTitle.includes('nhân sư') ||
          exTitle.includes('lạc đà')
        );
      }
      if (t.includes('giãn cơ') || t.includes('mở hông') || t.includes('deep stretch') || t.includes('háng')) {
        return (
          exCat.includes('flexibility') ||
          exTitle.includes('bồ câu') ||
          exTitle.includes('thằn lằn') ||
          exTitle.includes('malasana') ||
          exTitle.includes('happy baby') ||
          exTitle.includes('bướm')
        );
      }
      if (t.includes('flow') || t.includes('vinyasa') || t.includes('năng động')) {
        return (
          exCat.includes('core_flow') ||
          exCat.includes('standing') ||
          exTitle.includes('chào mặt trời') ||
          exTitle.includes('chiến binh') ||
          exTitle.includes('chaturanga')
        );
      }
      if (t.includes('hatha') || t.includes('nền tảng') || t.includes('căn bản') || t.includes('định tuyến')) {
        return (
          exCat.includes('standing') ||
          exCat.includes('recovery') ||
          exTitle.includes('núi') ||
          exTitle.includes('tam giác') ||
          exTitle.includes('thở') ||
          exTitle.includes('cây')
        );
      }
      if (t.includes('power') || t.includes('sức bền') || t.includes('thể lực')) {
        return (
          exCat.includes('core') ||
          exTitle.includes('plank') ||
          exTitle.includes('thuyền') ||
          exTitle.includes('ghế') ||
          exTitle.includes('quạ')
        );
      }
      if (t.includes('yin') || t.includes('dưỡng sinh') || t.includes('thiền') || t.includes('khí công') || t.includes('thần kinh')) {
        return (
          exCat.includes('recovery') ||
          exTitle.includes('savasana') ||
          exTitle.includes('thở') ||
          exTitle.includes('em bé') ||
          exTitle.includes('bướm')
        );
      }
    }

    if (d === 'BOXING') {
      if (t.includes('đòn tay thẳng') || t.includes('jab') || t.includes('cross') || t.includes('thẳng')) {
        return exCat.includes('punches') || exTitle.includes('jab') || exTitle.includes('cross') || exTitle.includes('đấm gió');
      }
      if (t.includes('móc') || t.includes('hook') || t.includes('uppercut')) {
        return exCat.includes('punches') && (exTitle.includes('móc') || exTitle.includes('hook') || exTitle.includes('uppercut'));
      }
      if (t.includes('bộ pháp') || t.includes('thế đứng') || t.includes('footwork') || t.includes('stance')) {
        return exCat.includes('footwork') || exCat.includes('conditioning') || exTitle.includes('đấm gió') || exTitle.includes('nhảy dây');
      }
      if (t.includes('phản xạ') || t.includes('né đòn') || t.includes('defense') || t.includes('slip') || t.includes('roll')) {
        return exCat.includes('defense') || exTitle.includes('né') || exTitle.includes('slip');
      }
      if (t.includes('combo') || t.includes('tổ hợp') || t.includes('liên hoàn')) {
        return exCat.includes('punches') || exCat.includes('pad_bag') || exTitle.includes('combo') || exTitle.includes('bao nặng');
      }
      if (t.includes('cardio') || t.includes('thể lực') || t.includes('conditioning') || t.includes('đốt mỡ') || t.includes('sức bền')) {
        return exCat.includes('conditioning') || exTitle.includes('nhảy dây') || exTitle.includes('burpee') || exTitle.includes('bóng tạ') || exTitle.includes('mountain');
      }
      if (t.includes('đá') || t.includes('kick') || t.includes('đối kháng') || t.includes('sparring')) {
        return exTitle.includes('sparring') || exTitle.includes('bao nặng') || exCat.includes('pad_bag');
      }
    }

    if (d === 'GYM') {
      if (t.includes('ngực') || t.includes('chest') || t.includes('bench press')) {
        return exCat.includes('chest') || exTitle.includes('ngực') || exTitle.includes('bench') || exTitle.includes('push up') || exTitle.includes('chống đẩy');
      }
      if (t.includes('lưng') || t.includes('xô') || t.includes('back') || t.includes('row') || t.includes('pull')) {
        return exCat.includes('back') || exTitle.includes('lưng') || exTitle.includes('xô') || exTitle.includes('pull') || exTitle.includes('row') || exTitle.includes('deadlift');
      }
      if (t.includes('chân') || t.includes('đùi') || t.includes('mông') || t.includes('squat') || t.includes('leg') || t.includes('glute')) {
        return exCat.includes('legs') || exTitle.includes('squat') || exTitle.includes('lunge') || exTitle.includes('đùi') || exTitle.includes('mông') || exTitle.includes('leg');
      }
      if (t.includes('vai') || t.includes('shoulder') || t.includes('press')) {
        return exCat.includes('shoulders') || exTitle.includes('vai') || exTitle.includes('overhead') || exTitle.includes('press');
      }
      if (t.includes('tay') || t.includes('biceps') || t.includes('triceps') || t.includes('arm')) {
        return exCat.includes('arms') || exTitle.includes('tay') || exTitle.includes('curl') || exTitle.includes('triceps') || exTitle.includes('biceps');
      }
      if (t.includes('bụng') || t.includes('core') || t.includes('lõi') || t.includes('abs')) {
        return exCat.includes('core') || exTitle.includes('bụng') || exTitle.includes('plank') || exTitle.includes('crunch');
      }
      if (t.includes('cardio') || t.includes('thể lực') || t.includes('giảm mỡ') || t.includes('khởi động') || t.includes('sức bền') || t.includes('nền tảng') || t.includes('chức năng')) {
        return exCat.includes('cardio') || exCat.includes('conditioning') || exCat.includes('core') || exTitle.includes('chạy') || exTitle.includes('nhảy') || exTitle.includes('burpee') || exTitle.includes('warmup') || exTitle.includes('squat');
      }
    }

    const words = t.split(/[\s,–-]+/).filter((w) => w.length > 2);
    return words.some((w) => exTitle.includes(w) || exCat.includes(w));
  });

  if (matched.length > 0) return matched;

  const fallback = exercises.filter((e) => {
    const disc = getExerciseDiscipline(e as any);
    return !d || d === 'ALL' || disc === d;
  });

  return fallback.length > 0 ? fallback : exercises;
}

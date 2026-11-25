// Gym images
import gymFacility from "@/assets/images/plan-gym-facility.jpg";
import ptTraining from "@/assets/images/plan-pt-training.jpg";
import strengthDuo from "@/assets/images/plan-strength-duo.png";

// Yoga images (5 ảnh phong phú: lớp học, nhóm tập, yoga bánh xe, phòng tập, thiền định)
import yogaMeditation from "@/assets/images/plan-yoga-meditation.png";
import yogaStudio from "@/assets/images/plan-yoga-studio.jpg";
import yogaClass from "@/assets/images/plan-yoga-class.png";
import yogaGroup from "@/assets/images/plan-yoga-group.png";
import yogaWheel from "@/assets/images/plan-yoga-wheel.png";

// Zumba / Modern dance images (3 ảnh nhảy Zumba)
import zumbaLine from "@/assets/images/plan-zumba-line.png";
import zumbaClass from "@/assets/images/plan-zumba-class.png";
import zumbaGroup from "@/assets/images/plan-zumba-group.png";

// Boxing images (2 ảnh Boxing)
import boxingRing from "@/assets/images/plan-boxing-ring.jpg";
import boxingTraining from "@/assets/images/plan-boxing-training.png";

// Premium facility & ambience
import premiumAmbience from "@/assets/images/plan-premium-ambience.jpg";

export interface GalleryPhoto {
  id: string;
  url: string;
  title: string;
  tag: string;
  category: "GYM" | "YOGA" | "ZUMBA" | "BOXING" | "FACILITY";
  description: string;
}

export const planGallery: GalleryPhoto[] = [
  // Boxing Photos
  {
    id: "boxing-ring",
    url: boxingRing,
    title: "Võ Đài Boxing & Sàn Đấu Chuẩn Quốc Tế",
    tag: "Đặc quyền Boxing VIP",
    category: "BOXING",
    description:
      "Võ đài tiêu chuẩn thi đấu chuyên nghiệp.",
  },
  {
    id: "boxing-training",
    url: boxingTraining,
    title: "Lớp Tập Luyện Boxing & Kickboxing Thực Chiến",
    tag: "Tăng phản xạ & Thể lực",
    category: "BOXING",
    description:
      "Rèn luyện kỹ thuật đấm, né đòn, nâng cao phản xạ và đốt cháy calo vượt trội cùng các võ sư & HLV Boxing chuyên nghiệp.",
  },

  // Zumba & Dance Photos
  {
    id: "zumba-class",
    url: zumbaClass,
    title: "Lớp Nhảy Zumba Vũ Điệu Bùng Nổ",
    tag: "Sôi động & Đốt mỡ",
    category: "ZUMBA",
    description:
      "Hòa mình vào âm nhạc sôi động với sự dẫn dắt của HLV Zumba tràn đầy năng lượng, giúp giải tỏa stress và cải thiện vóc dáng.",
  },
  {
    id: "zumba-group",
    url: zumbaGroup,
    title: "Không Gian Nhảy Hiện Đại & Dance Fitness",
    tag: "Phong cách sống năng động",
    category: "ZUMBA",
    description:
      "Phòng tập gương toàn cảnh rộng rãi, âm thanh chất lượng phòng thu giúp từng bước nhảy của bạn thêm phần tự tin và thăng hoa.",
  },
  {
    id: "zumba-line",
    url: zumbaLine,
    title: "Nhóm Vũ Đạo Trẻ Trung & Đam Mê",
    tag: "Kết nối cộng đồng",
    category: "ZUMBA",
    description:
      "Nơi giao lưu, kết bạn và cùng nhau lan tỏa nguồn năng lượng tươi trẻ qua từng nhịp điệu khiêu vũ thể thao lôi cuốn.",
  },

  // Yoga Photos (Đa dạng 5 góc chụp cao cấp)
  {
    id: "yoga-group",
    url: yogaGroup,
    title: "Lớp Yoga Thảm & Nhịp Thở Tràn Năng Lượng",
    tag: "Tươi trẻ & Tràn đầy sức sống",
    category: "YOGA",
    description:
      "Lớp thưa giãn , hồi phục tinh thần cơ thể",
  },
  {
    id: "yoga-wheel",
    url: yogaWheel,
    title: "Yoga Bánh Xe Chuyên Dụng (Wheel Yoga)",
    tag: "Uốn dẻo & Trị liệu cột sống",
    category: "YOGA",
    description:
      "Phương pháp tập luyện hỗ trợ với vòng Yoga chuyên dụng giúp giải phóng áp lực vùng lưng, mở khớp vai và tăng độ mềm mại dẻo dai hoàn hảo.",
  },
  {
    id: "yoga-class",
    url: yogaClass,
    title: "Lớp Học Yoga & Thiền Định Chuyên Sâu",
    tag: "Tĩnh tâm & Phục hồi",
    category: "YOGA",
    description:
      "Buổi thực hành Yoga và thiền định tập trung trong không gian ấm áp, ánh sáng dịu nhẹ dưới sự dẫn dắt của Master Yoga quốc tế.",
  },
  {
    id: "yoga-studio",
    url: yogaStudio,
    title: "Studio Yoga Ánh Sáng Tự Nhiên & Gương Toàn Cảnh",
    tag: "Không gian 5 sao chuẩn mực",
    category: "YOGA",
    description:
      "Không gian thảm tập định hình chuẩn mực, thiết kế nghệ thuật đón ánh sáng tự nhiên và hương thơm tinh dầu thảo mộc thư thái.",
  },
  {
    id: "yoga-meditation",
    url: yogaMeditation,
    title: "Kỹ Thuật Cân Bằng Thân Tâm & Asana",
    tag: "Cân bằng & Dẻo dai",
    category: "YOGA",
    description:
      "Thực hành kiểm soát nhịp thở Pranayama, cải thiện đường cong cột sống và xây dựng sức bền dẻo dai toàn diện của cơ thể.",
  },

  // Gym Photos
  {
    id: "gym-facility",
    url: gymFacility,
    title: "Khu Vực Tập Luyện Thể Hình Olympic",
    tag: "Máy tập chuẩn thế giới",
    category: "GYM",
    description:
      "Hệ thống máy cardio, máy khối Technogym cao cấp và sàn gỗ chống trượt mang lại trải nghiệm vận động chuẩn vận động viên.",
  },
  {
    id: "pt-training",
    url: ptTraining,
    title: "Huấn Luyện Viên Cá Nhân 1:1 Chuyên Sâu",
    tag: "Đặc quyền gói VIP",
    category: "GYM",
    description:
      "HLV có chứng chỉ quốc tế kèm cặp sát sao từng hiệp tập, căn chỉnh form dáng và thiết kế giáo án dinh dưỡng cá nhân hóa.",
  },
  {
    id: "strength-duo",
    url: strengthDuo,
    title: "Khu Vực Free-Weights & Nâng Tạ Đòn",
    tag: "Tăng cơ & Sức mạnh",
    category: "GYM",
    description:
      "Giàn tạ đòn, tạ chuông kettlebell và không gian tập luyện bùng nổ sức mạnh, phục hồi thể lực tối đa.",
  },

  // Ambient Facility
  {
    id: "premium-ambience",
    url: premiumAmbience,
    title: "Không Gian Âm Thanh Đa Vùng 5 Sao",
    tag: "Tiện ích đẳng cấp",
    category: "FACILITY",
    description:
      "Âm thanh vòm phân tán khoa học, hệ thống lọc khí tươi liên tục duy trì oxy tối ưu trong suốt buổi tập luyện.",
  },
];

export function getPlanImage(
  disciplineCodeOrName?: string,
  tier?: string,
  planName?: string,
  planId?: string
): string {
  const disc = (disciplineCodeOrName || "").toLowerCase();
  const name = (planName || "").toLowerCase();
  const t = (tier || "").toUpperCase();

  // 1. BOXING: Phân loại gói Boxing lấy ảnh Boxing
  if (
    disc.includes("box") ||
    disc.includes("combat") ||
    disc.includes("võ") ||
    name.includes("box")
  ) {
    if (t === "VIP") return boxingRing;
    return boxingTraining;
  }

  // 2. ZUMBA / DANCE: Phân loại gói nhảy Zumba lấy ảnh Zumba
  if (
    disc.includes("zumba") ||
    disc.includes("dance") ||
    disc.includes("nhảy") ||
    disc.includes("dancing") ||
    name.includes("zumba") ||
    name.includes("dance")
  ) {
    if (t === "VIP") return zumbaGroup;
    if (t === "PLUS") return zumbaClass;
    return zumbaLine;
  }

  // 3. YOGA: Phân loại gói Yoga lấy ảnh Yoga đa dạng và phong phú
  if (
    disc.includes("yoga") ||
    disc.includes("thiền") ||
    disc.includes("meditation") ||
    disc.includes("mind") ||
    name.includes("yoga")
  ) {
    // 3.1 Nhận diện theo phong cách Yoga cụ thể trong tên gói
    if (
      name.includes("vinyasa") ||
      name.includes("wheel") ||
      name.includes("vòng") ||
      name.includes("uốn") ||
      name.includes("trị liệu")
    ) {
      return yogaWheel;
    }
    if (
      name.includes("hatha") ||
      name.includes("cơ bản") ||
      name.includes("nhóm") ||
      name.includes("group")
    ) {
      return yogaGroup;
    }
    if (
      name.includes("hot") ||
      name.includes("nhiệt") ||
      name.includes("studio") ||
      name.includes("phòng")
    ) {
      return yogaStudio;
    }
    if (
      name.includes("thiền") ||
      name.includes("meditation") ||
      name.includes("yin") ||
      name.includes("phục hồi") ||
      name.includes("thư giãn")
    ) {
      return yogaMeditation;
    }
    if (
      name.includes("vip") ||
      name.includes("master") ||
      name.includes("nâng cao") ||
      name.includes("kèm") ||
      t === "VIP"
    ) {
      return yogaClass;
    }

    // 3.2 Nhận diện theo gói Plus / Thời hạn
    if (t === "PLUS") {
      if (name.includes("12") || name.includes("năm")) return yogaClass;
      if (name.includes("6") || name.includes("tháng")) return yogaWheel;
      if (name.includes("3") || name.includes("quý")) return yogaStudio;
      return yogaGroup;
    }

    // 3.3 Phân bổ xoay vòng theo tên và ID để các gói cùng loại luôn có ảnh khác nhau
    const yogaPool = [yogaGroup, yogaWheel, yogaStudio, yogaClass, yogaMeditation];
    const key = `${name}-${planId || ""}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return yogaPool[Math.abs(hash) % yogaPool.length];
  }

  // 4. GYM & FITNESS: Phân loại gói Gym lấy ảnh Gym
  if (
    disc.includes("gym") ||
    disc.includes("fitness") ||
    name.includes("gym") ||
    name.includes("fitness")
  ) {
    if (t === "VIP") return ptTraining;
    if (t === "PLUS") return strengthDuo;
    return gymFacility;
  }

  // Fallback chung
  if (t === "VIP") return ptTraining;
  return gymFacility;
}

export function getDisciplineGallery(
  disciplineCodeOrName?: string,
  planName?: string
): GalleryPhoto[] {
  const disc = (disciplineCodeOrName || "").toLowerCase();
  const name = (planName || "").toLowerCase();

  // 1. BOXING: Chỉ show ảnh của Boxing
  if (
    disc.includes("box") ||
    disc.includes("combat") ||
    disc.includes("võ") ||
    name.includes("box")
  ) {
    return planGallery.filter((p) => p.category === "BOXING");
  }

  // 2. ZUMBA / DANCING: Chỉ show ảnh của Zumba / Dance
  if (
    disc.includes("zumba") ||
    disc.includes("dance") ||
    disc.includes("nhảy") ||
    disc.includes("dancing") ||
    name.includes("zumba") ||
    name.includes("dance")
  ) {
    return planGallery.filter((p) => p.category === "ZUMBA");
  }

  // 3. YOGA: Chỉ show ảnh của Yoga (5 ảnh phong phú)
  if (
    disc.includes("yoga") ||
    disc.includes("thiền") ||
    disc.includes("meditation") ||
    disc.includes("mind") ||
    name.includes("yoga")
  ) {
    return planGallery.filter((p) => p.category === "YOGA");
  }

  // 4. GYM & FITNESS: Chỉ show ảnh của Gym
  return planGallery.filter((p) => p.category === "GYM");
}


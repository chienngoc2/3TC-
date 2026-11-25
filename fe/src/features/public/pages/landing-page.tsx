import React, { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/context/auth-context'
import logo3tc from '@/assets/images/logo-3tc.png'
import planGymFacility from '@/assets/images/plan-gym-facility.jpg'
import planPtTraining from '@/assets/images/plan-pt-training.jpg'
import planBoxingRing from '@/assets/images/plan-boxing-ring.jpg'
import planYogaStudio from '@/assets/images/plan-yoga-studio.jpg'
import {
  CheckCircle2,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  ArrowRight,
  Check,
  Trophy,
  ShieldCheck,
  Lock,
  FileText,
  Activity,
  CreditCard,
  Smartphone,
  UserCheck,
  Dumbbell,
  Calendar,
  BookOpen,
} from 'lucide-react'

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth()

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false)
  const [mobileLegalOpen, setMobileLegalOpen] = useState(false)

  // Active section tracking for ScrollSpy
  const [activeSection, setActiveSection] = useState('hero')

  // FAQ Accordion State (default open first question)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // Lead form state
  const [leadName, setLeadName] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [leadSubmitted, setLeadSubmitted] = useState(false)

  // Resolve Portal redirect based on user's role
  const getPortalPath = (role?: string) => {
    switch (role) {
      case 'COACH':
        return '/coach/schedule'
      case 'CENTER_MANAGER':
      case 'RECEPTIONIST':
        return '/portal/desk'
      case 'ADMIN':
        return '/console/metrics'
      case 'MEMBER':
      default:
        return '/portal/member/bookings'
    }
  }

  // Smooth scroll handler with offset for sticky header
  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false)
    const element = document.getElementById(id)
    if (element) {
      const headerOffset = 68
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }

  // ScrollSpy via IntersectionObserver / scroll listener
  useEffect(() => {
    const sections = ['hero', 'about', 'features', 'faq', 'guide', 'legal']

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 130
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId)
        if (el) {
          const top = el.offsetTop
          const height = el.offsetHeight
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadName || !leadPhone) return
    setLeadSubmitted(true)
    setTimeout(() => {
      setLeadSubmitted(false)
      setLeadName('')
      setLeadPhone('')
    }, 4000)
  }

  return (
    <div className="min-h-screen w-full bg-white text-slate-800 font-sans selection:bg-[#17664e] selection:text-white antialiased">
      {/* =========================================================================
          STICKY NAVBAR (LIGHT CLEAN THEME & EMERALD TEAL #17664e)
          ========================================================================= */}
      <header className="sticky top-0 z-50 shrink-0 flex justify-between items-center px-4 sm:px-8 lg:px-10 py-3 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs transition-all w-full">
        {/* 1. Left: Brand Logo (đồng bộ với auth/login) */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 font-bold text-slate-900 group transition-transform cursor-pointer"
        >
          <img
            src={logo3tc}
            alt="3TC FITNESS"
            className="h-8 md:h-9 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <span className="font-black text-lg tracking-tight text-slate-900">
            3TC <span className="text-[#17664e]">FITNESS</span>
          </span>
        </button>

        {/* 2. Center: Navigation Links with Smooth Scroll + Dropdown (Desktop) */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-[14px] font-semibold text-slate-600">
          {/* Giới thiệu (#about) */}
          <button
            type="button"
            onClick={() => scrollToSection('about')}
            className={`transition-colors cursor-pointer ${
              activeSection === 'about'
                ? 'text-[#17664e] font-bold'
                : 'text-slate-600 hover:text-[#17664e]'
            }`}
          >
            Giới thiệu
          </button>

          {/* Tính năng (#features) */}
          <button
            type="button"
            onClick={() => scrollToSection('features')}
            className={`transition-colors cursor-pointer ${
              activeSection === 'features'
                ? 'text-[#17664e] font-bold'
                : 'text-slate-600 hover:text-[#17664e]'
            }`}
          >
            Tính năng
          </button>

          {/* Bảng giá (/plans) */}
          <Link
            to="/plans"
            className="transition-colors cursor-pointer text-slate-600 hover:text-[#17664e]"
          >
            Bảng giá
          </Link>

          {/* Hỏi đáp (#faq) */}
          <button
            type="button"
            onClick={() => scrollToSection('faq')}
            className={`transition-colors cursor-pointer ${
              activeSection === 'faq'
                ? 'text-[#17664e] font-bold'
                : 'text-slate-600 hover:text-[#17664e]'
            }`}
          >
            Hỏi đáp
          </button>

          {/* Hướng dẫn ⌄ (#guide Dropdown) */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => scrollToSection('guide')}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeSection === 'guide'
                  ? 'text-[#17664e] font-bold'
                  : 'text-slate-600 hover:text-[#17664e]'
              }`}
            >
              <span>Hướng dẫn</span>
              <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180 text-slate-400 group-hover:text-[#17664e]" />
            </button>
            {/* Dropdown menu */}
            <div className="absolute left-0 top-full pt-2 w-64 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200">
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl p-2 space-y-1 text-xs">
                <button
                  type="button"
                  onClick={() => scrollToSection('guide-booking')}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-[#17664e] font-medium transition-colors cursor-pointer"
                >
                  Hướng dẫn Đăng ký & Đặt lịch
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('guide-checkin')}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-[#17664e] font-medium transition-colors cursor-pointer"
                >
                  Hướng dẫn Check-in & Tủ đồ
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('guide-coach')}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-[#17664e] font-medium transition-colors cursor-pointer"
                >
                  Hướng dẫn Huấn luyện viên
                </button>
              </div>
            </div>
          </div>

          {/* Pháp lý ⌄ (#legal Dropdown) */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => scrollToSection('legal')}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeSection === 'legal'
                  ? 'text-[#17664e] font-bold'
                  : 'text-slate-600 hover:text-[#17664e]'
              }`}
            >
              <span>Pháp lý</span>
              <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180 text-slate-400 group-hover:text-[#17664e]" />
            </button>
            {/* Dropdown menu */}
            <div className="absolute left-0 top-full pt-2 w-60 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200">
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl p-2 space-y-1 text-xs">
                <button
                  type="button"
                  onClick={() => scrollToSection('terms')}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-[#17664e] font-medium transition-colors cursor-pointer"
                >
                  Điều khoản Dịch vụ
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('privacy')}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-[#17664e] font-medium transition-colors cursor-pointer"
                >
                  Chính sách Bảo mật Thông tin
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('refund-policy')}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-[#17664e] font-medium transition-colors cursor-pointer"
                >
                  Quy chế Hủy lịch & Hoàn tiền
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* 3. Right: Portal Action Buttons (đồng bộ phong cách với auth/login) */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-bold">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="h-6 w-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] uppercase overflow-hidden">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user.fullName?.charAt(0) || 'U'
                  )}
                </div>
                <span className="font-semibold text-slate-800 max-w-[120px] truncate">
                  {user.fullName || user.email}
                </span>
              </div>
              <Link
                to={getPortalPath(user.role)}
                className="px-3.5 py-1.5 rounded-xl bg-[#17664e] hover:bg-[#135641] text-white font-bold transition-all shadow-xs shadow-emerald-700/20 flex items-center gap-1.5"
              >
                <span>Vào Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/auth/login"
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition-colors shadow-2xs cursor-pointer"
              >
                Đăng nhập
              </Link>
              <Link
                to="/auth/register"
                className="px-3.5 py-1.5 rounded-xl bg-[#17664e] text-white hover:bg-[#135641] font-bold transition-colors shadow-xs shadow-emerald-700/20 cursor-pointer"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-5 shadow-2xl space-y-4">
            <nav className="flex flex-col gap-3 text-sm font-semibold text-slate-700">
              <button
                type="button"
                onClick={() => scrollToSection('about')}
                className={`text-left py-1.5 ${
                  activeSection === 'about' ? 'text-[#17664e] font-bold' : 'hover:text-[#17664e]'
                }`}
              >
                Giới thiệu
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('features')}
                className={`text-left py-1.5 ${
                  activeSection === 'features' ? 'text-[#17664e] font-bold' : 'hover:text-[#17664e]'
                }`}
              >
                Tính năng
              </button>
              <Link
                to="/plans"
                onClick={() => setMobileMenuOpen(false)}
                className="text-left py-1.5 hover:text-[#17664e]"
              >
                Bảng giá
              </Link>
              <button
                type="button"
                onClick={() => scrollToSection('faq')}
                className={`text-left py-1.5 ${
                  activeSection === 'faq' ? 'text-[#17664e] font-bold' : 'hover:text-[#17664e]'
                }`}
              >
                Hỏi đáp
              </button>

              {/* Mobile Hướng dẫn accordion */}
              <div className="border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => setMobileGuideOpen(!mobileGuideOpen)}
                  className="flex items-center justify-between w-full py-1.5 text-left text-slate-700 hover:text-[#17664e]"
                >
                  <span>Hướng dẫn</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${mobileGuideOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {mobileGuideOpen && (
                  <div className="pl-4 py-2 space-y-2.5 text-xs text-slate-600 bg-slate-50/80 rounded-xl my-1 p-3">
                    <button
                      type="button"
                      onClick={() => scrollToSection('guide-booking')}
                      className="block text-left hover:text-[#17664e]"
                    >
                      Hướng dẫn Đăng ký & Đặt lịch
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('guide-checkin')}
                      className="block text-left hover:text-[#17664e]"
                    >
                      Hướng dẫn Check-in & Tủ đồ
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('guide-coach')}
                      className="block text-left hover:text-[#17664e]"
                    >
                      Hướng dẫn Huấn luyện viên
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Pháp lý accordion */}
              <div className="border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => setMobileLegalOpen(!mobileLegalOpen)}
                  className="flex items-center justify-between w-full py-1.5 text-left text-slate-700 hover:text-[#17664e]"
                >
                  <span>Pháp lý</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${mobileLegalOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {mobileLegalOpen && (
                  <div className="pl-4 py-2 space-y-2.5 text-xs text-slate-600 bg-slate-50/80 rounded-xl my-1 p-3">
                    <button
                      type="button"
                      onClick={() => scrollToSection('terms')}
                      className="block text-left hover:text-[#17664e]"
                    >
                      Điều khoản Dịch vụ
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('privacy')}
                      className="block text-left hover:text-[#17664e]"
                    >
                      Chính sách Bảo mật Thông tin
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('refund-policy')}
                      className="block text-left hover:text-[#17664e]"
                    >
                      Quy chế Hủy lịch & Hoàn tiền
                    </button>
                  </div>
                )}
              </div>
            </nav>

            {/* Mobile Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-3">
              {isAuthenticated && user ? (
                <Link
                  to={getPortalPath(user.role)}
                  className="flex-1 py-2.5 text-center bg-[#17664e] text-white rounded-xl text-xs font-bold"
                >
                  Vào Cổng ({user.fullName?.split(' ')[0] || 'Me'})
                </Link>
              ) : (
                <>
                  <Link
                    to="/auth/login"
                    className="flex-1 py-2.5 text-center border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/auth/register"
                    className="flex-1 py-2.5 text-center bg-[#17664e] hover:bg-[#135641] text-white rounded-xl text-xs font-bold"
                  >
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          1. PHẦN BANNER CHÍNH (HERO SECTION) (#hero)
          ========================================================================= */}
      <section
        id="hero"
        className="relative pt-12 pb-20 md:py-24 bg-gradient-to-b from-slate-50/80 via-white to-slate-50/50 border-b border-slate-200/80 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Cột trái: Nội dung chính */}
            <div className="lg:col-span-7 space-y-6">
              {/* Tagline / Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/90 text-[#17664e] text-xs font-bold tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-[#17664e]" />
                <span>Hệ thống Quản lý & Luyện tập Thể thao Thông minh Thế hệ mới</span>
              </div>

              {/* Tiêu đề chính (H1) */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight">
                Bứt Phá Giới Hạn Cùng{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#17664e] via-emerald-600 to-teal-500">
                  3TC FITNESS
                </span>
              </h1>

              {/* Mô tả phụ */}
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Trải nghiệm không gian tập luyện đẳng cấp đa bộ môn (Gym, Boxing, Yoga) kết hợp nền
                tảng công nghệ số hóa: đặt lịch PT 1-1 tức thì, tủ đồ thông minh không chạm, phân
                tích InBody và giáo án chuẩn hóa dành riêng cho bạn.
              </p>

              {/* Nút Call-To-Action (CTA) */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/plans"
                  className="px-6 py-3.5 rounded-xl bg-[#17664e] hover:bg-[#135641] text-white text-sm font-bold transition-all shadow-md shadow-emerald-700/20 flex items-center gap-2 cursor-pointer"
                >
                  <span>Trải Nghiệm Miễn Phí Ngay (0đ)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection('features')}
                  className="px-6 py-3.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold transition-all cursor-pointer shadow-xs"
                >
                  Khám Phá Tính Năng
                </button>
              </div>

              {/* Thống kê nhanh (Stats Counter) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-slate-200/80">
                {[
                  { value: '3+', label: 'Bộ môn chuyên sâu', desc: 'Gym, Boxing, Yoga' },
                  { value: '100%', label: 'Tự động hóa', desc: 'Đặt lịch' },
                  { value: '24+', label: 'Giáo án chuẩn', desc: 'Cá nhân hóa theo thể trạng' },
                  { value: '24/7', label: 'Tủ đồ thông minh', desc: 'Kiểm soát an toàn tối đa' },
                ].map((stat, sIdx) => (
                  <div key={sIdx} className="space-y-1">
                    <span className="text-2xl font-black text-[#17664e] tracking-tight">
                      {stat.value}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">{stat.label}</h4>
                    <p className="text-[11px] text-slate-500 leading-tight">{stat.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cột phải: Hình ảnh Hero + Feature Chips */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden border border-slate-200/90 shadow-2xl shadow-emerald-950/5 group bg-slate-100">
                <img
                  src={planPtTraining}
                  alt="3TC Fitness Luyện tập chuẩn quốc tế"
                  className="w-full h-[460px] sm:h-[520px] object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                {/* Floating Badge: InBody & Giáo án */}
                <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-slate-900">
                        Phân Tích InBody & Giáo Án 1-1
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        Đo chỉ số cơ - mỡ - nước chuẩn y khoa
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-[#17664e] text-[10px] font-extrabold uppercase">
                    Chuẩn 5★
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. GIỚI THIỆU (id="about")
          ========================================================================= */}
      <section id="about" className="py-24 bg-white border-b border-slate-200/80 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold text-[#17664e] uppercase tracking-wider">
              Hành trình sức khỏe
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Về 3TC Fitness – Định Hình Lối Sống Khỏe & Hiện Đại
            </h2>
            <div className="w-12 h-1 bg-[#17664e] mx-auto rounded-full mt-2" />
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed pt-2">
              3TC Fitness không chỉ là phòng tập, mà là một hệ sinh thái chăm sóc sức khỏe toàn
              diện. Chúng tôi kết hợp giữa cơ sở vật chất hiện đại và nền tảng công nghệ 4.0 nhằm
              mang đến trải nghiệm tập luyện tiện lợi, minh bạch và hiệu quả nhất cho từng hội viên.
            </p>
          </div>

          {/* 3 Trụ cột cốt lõi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Trụ cột 1: Không gian đa bộ môn */}
            <div className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:shadow-lg hover:border-emerald-200 transition-all group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-[#17664e] flex items-center justify-center font-bold">
                  <Dumbbell className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-[#17664e] transition-colors">
                  Không Gian Đa Bộ Môn Chuyên Sâu
                </h3>
                <ul className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#17664e] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-800">Gym & Fitness:</strong> Không gian 50+
                      người với dàn thiết bị tạ, máy khối và cardio ngoại nhập chuẩn Olympic.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#17664e] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-800">Boxing & Kickboxing Studio:</strong> Sàn
                      tập chuyên biệt, bao cát đối kháng, găng đấu tiêu chuẩn giúp xả stress và tăng
                      sức bền tim mạch.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#17664e] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-800">Yoga & Meditation Sanctuary:</strong> Phòng
                      tập yên tĩnh, ánh sáng dịu nhẹ với trường phái Hatha, Vinyasa và Hot Yoga giúp
                      cân bằng thân - tâm - trí.
                    </span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/80">
                <div className="h-40 rounded-2xl overflow-hidden">
                  <img
                    src={planGymFacility}
                    alt="Gym Facility"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </div>
            </div>

            {/* Trụ cột 2: Đội ngũ Huấn luyện viên */}
            <div className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:shadow-lg hover:border-emerald-200 transition-all group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-[#17664e] flex items-center justify-center font-bold">
                  <Trophy className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-[#17664e] transition-colors">
                  Đội Ngũ HLV Chứng Chỉ Quốc Tế
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  100% Huấn luyện viên có trên 5 năm kinh nghiệm thực chiến, kèm 1-1 chuyên sâu và
                  theo sát từng buổi tập từ kỹ thuật động tác đến chế độ dinh dưỡng hàng ngày.
                </p>
                <div className="space-y-2 pt-2">
                  {[
                    'Chứng chỉ đào tạo thể hình quốc tế NASM & ACE',
                    'Giáo án tối ưu riêng biệt theo chỉ số thể trạng',
                    'Đồng hành tâm lý & truyền cảm hứng kiên trì',
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-slate-700 font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#17664e]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/80">
                <div className="h-40 rounded-2xl overflow-hidden">
                  <img
                    src={planBoxingRing}
                    alt="Boxing Ring & HLV"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </div>
            </div>

            {/* Trụ cột 3: Số hóa quy trình vận hành */}
            <div className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:shadow-lg hover:border-emerald-200 transition-all group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-[#17664e] flex items-center justify-center font-bold">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-[#17664e] transition-colors">
                  Số Hóa Quy Trình Vận Hành 4.0
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Không còn thẻ nhựa cồng kềnh hay sổ sách thủ công. Mọi thao tác từ mở tủ đồ thông
                  minh, đặt lịch tập, xem tiến độ đến thanh toán đều được gói gọn trên ứng dụng.
                </p>
                <div className="space-y-2 pt-2">
                  {[
                    'Check-in vào cửa chỉ trong 1 giây',
                    'Mở tủ đồ thông minh tự động chỉ định phân khu',
                    'Minh bạch lịch sử giao dịch và hóa đơn điện tử',
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-slate-700 font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#17664e]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/80">
                <div className="h-40 rounded-2xl overflow-hidden">
                  <img
                    src={planYogaStudio}
                    alt="Yoga Studio"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. TÍNH NĂNG NỔI BẬT DÀNH CHO HỘI VIÊN (id="features")
          ========================================================================= */}
      <section
        id="features"
        className="py-24 bg-slate-50/60 border-b border-slate-200/80 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold text-[#17664e] uppercase tracking-wider">
              Công nghệ phục vụ hội viên
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Hệ Sinh Thái Tính Năng Dành Cho Hội Viên
            </h2>
            <div className="w-12 h-1 bg-[#17664e] mx-auto rounded-full mt-2" />
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed pt-2">
              Nền tảng công nghệ All-in-One giúp bạn chủ động thời gian, nhận giáo án chuẩn xác và
              theo dõi trọn vẹn lộ trình nâng tầm thể chất.
            </p>
          </div>

          {/* Lưới 6 tính năng cốt lõi của Member */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                title: 'Đặt lịch PT & Lớp học linh hoạt',
                desc: 'Tự do chọn khung giờ, chọn HLV ưa thích hoặc giữ chỗ lớp Yoga/Boxing chỉ với 1 chạm nhanh chóng.',
                icon: Calendar,
              },
              {
                title: 'Giáo án tập luyện cá nhân hóa',
                desc: 'Tự động nhận giáo án chi tiết từng bài (số set, số rep, mức tạ, thời gian nghỉ) ngay khi xác nhận lịch.',
                icon: BookOpen,
              },
              {
                title: 'Theo dõi tiến độ & InBody 3D',
                desc: 'Lưu trữ chỉ số cơ - mỡ - nước qua từng mốc thời gian, trực quan hóa biểu đồ chuyển biến vóc dáng.',
                icon: Activity,
              },
              {
                title: 'Tủ đồ thông minh (Smart Lockers)',
                desc: 'Tự động cấp phát và chỉ định phân khu tủ an toàn, bảo vệ tư trang riêng tư suốt buổi tập.',
                icon: Lock,
              },
              {
                title: 'Gia hạn & Mua thêm buổi PT (Add-on)',
                desc: 'Thanh toán trực tuyến bảo mật, linh hoạt gia hạn gói hoặc nạp thêm buổi kèm 1-1 khi có nhu cầu.',
                icon: CreditCard,
              },
              {
                title: 'Minh bạch lịch sử & Thẻ hội viên số',
                desc: 'Kiểm tra lịch sử điểm danh, số buổi tập còn lại và tra cứu hóa đơn điện tử mọi lúc mọi nơi.',
                icon: CheckCircle2,
              },
            ].map((feat, fIdx) => (
              <div
                key={fIdx}
                className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all space-y-4 group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#17664e] flex items-center justify-center font-bold group-hover:scale-105 group-hover:bg-[#17664e] group-hover:text-white transition-all shadow-2xs">
                    <feat.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#17664e] transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. HỎI ĐÁP THƯỜNG GẶP (id="faq")
          ========================================================================= */}
      <section id="faq" className="py-24 bg-slate-50/60 border-b border-slate-200/80 scroll-mt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold text-[#17664e] uppercase tracking-wider">
              Hỗ trợ khách hàng
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Giải Đáp Thắc Mắc (FAQ)
            </h2>
            <div className="w-12 h-1 bg-[#17664e] mx-auto rounded-full mt-2" />
            <p className="text-slate-600 text-sm leading-relaxed pt-2">
              Những câu hỏi thường gặp nhất về quyền lợi, cách đăng ký và sử dụng dịch vụ tại 3TC
              Fitness.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'Q1: Tôi là người mới chưa từng tập luyện thì nên bắt đầu từ gói nào?',
                a: 'Bạn nên đăng ký ngay gói TRIAL (0 VNĐ). Bạn sẽ có 3 - 7 ngày trải nghiệm toàn bộ tiện ích, được đo chỉ số InBody miễn phí và nhận tư vấn định hướng từ Huấn luyện viên trước khi quyết định mua gói dài hạn.',
              },
              {
                q: 'Q2: Làm thế nào để đặt lịch tập với Huấn luyện viên cá nhân (PT)?',
                a: "Sau khi đăng ký gói VIP hoặc mua thêm buổi PT Add-on, bạn chỉ cần đăng nhập ứng dụng, chọn mục 'Đặt lịch PT', chọn khung giờ trống của HLV bạn mong muốn và xác nhận. Giáo án của buổi tập hôm đó sẽ tự động hiển thị trong tài khoản của bạn.",
              },
              {
                q: 'Q3: Tôi có thể hủy lịch tập đã đặt trước không?',
                a: 'Hoàn toàn được. Bạn có thể tự do hủy lịch trước giờ tập ít nhất 2 tiếng trên ứng dụng mà không bị trừ buổi tập. Nếu hủy sát giờ dưới 2 tiếng hoặc vắng mặt không báo trước, hệ thống sẽ tính là 1 buổi đã sử dụng.',
              },
              {
                q: 'Q4: Hệ thống Tủ đồ Thông minh (Smart Locker) hoạt động như thế nào?',
                a: 'Khi bạn check-in qua cổng hoặc tại quầy lễ tân, hệ thống tự động gán cho bạn 1 mã tủ đồ còn trống theo phân khu Nam/Nữ. Bạn sử dụng mã số tủ trên ứng dụng hoặc tài khoản hội viên để mở tủ trong suốt thời gian tập luyện.',
              },
              {
                q: 'Q5: Nếu gói tập của tôi sắp hết buổi PT nhưng vẫn còn ngày hạn gói thì sao?',
                a: "Bạn có thể sử dụng tính năng 'Mua thêm buổi PT (PT Add-on)' ngay trên ứng dụng với mức giá ưu đãi theo HLV hiện tại mà không cần phải mua lại một gói hội viên hoàn toàn mới.",
              },
            ].map((faq, fIdx) => (
              <div
                key={fIdx}
                className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === fIdx ? null : fIdx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-slate-800 hover:text-[#17664e] transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      openFaq === fIdx ? 'rotate-180 text-[#17664e]' : ''
                    }`}
                  />
                </button>
                {openFaq === fIdx && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. HƯỚNG DẪN SỬ DỤNG (id="guide" - Cho Menu Dropdown)
          ========================================================================= */}
      <section id="guide" className="py-24 bg-white border-b border-slate-200/80 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold text-[#17664e] uppercase tracking-wider">
              Cẩm nang & Thao tác
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Hướng Dẫn Sử Dụng Nền Tảng 3TC Fitness
            </h2>
            <div className="w-12 h-1 bg-[#17664e] mx-auto rounded-full mt-2" />
            <p className="text-slate-600 text-sm leading-relaxed pt-2">
              Quy trình chuẩn hóa từng bước giúp bạn thao tác nhanh chóng và làm chủ hệ thống tập
              luyện thông minh.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Guide 1: Đăng ký & Đặt lịch (#guide-booking) */}
            <div
              id="guide-booking"
              className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-5 scroll-mt-28"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-[#17664e] flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Hướng Dẫn Đăng Ký & Đặt Lịch</h3>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-600">
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#17664e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </span>
                  <p>
                    <strong className="text-slate-800">Bước 1:</strong> Nhấn nút{' '}
                    <strong>Đăng ký</strong> trên thanh điều hướng, nhập Họ tên, Số điện thoại và
                    Email.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#17664e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </span>
                  <p>
                    <strong className="text-slate-800">Bước 2:</strong> Chọn gói tập mong muốn tại
                    mục Bảng giá và hoàn tất thanh toán.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#17664e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </span>
                  <p>
                    <strong className="text-slate-800">Bước 3:</strong> Vào mục{' '}
                    <strong>Lịch tập</strong>, chọn môn học (Gym, Boxing, Yoga) hoặc chọn HLV riêng,
                    chọn khung giờ còn trống và ấn <strong>Xác nhận đặt chỗ</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Guide 2: Check-in & Tủ đồ (#guide-checkin) */}
            <div
              id="guide-checkin"
              className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-5 scroll-mt-28"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-[#17664e] flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Hướng Dẫn Check-in & Tủ Đồ</h3>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-600">
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#17664e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </span>
                  <p>
                    <strong className="text-slate-800">Bước 1:</strong> Khi đến trung tâm, mở ứng
                    dụng và xuất trình <strong>Mã Hội viên</strong> tại quầy hoặc máy quét cổng.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#17664e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </span>
                  <p>
                    <strong className="text-slate-800">Bước 2:</strong> Ứng dụng thông báo số tủ đồ
                    được chỉ định (Ví dụ: M-05 cho Nam hoặc F-03 cho Nữ).
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#17664e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </span>
                  <p>
                    <strong className="text-slate-800">Bước 3:</strong> Nhập mã số tủ tại khu vực
                    locker để mở khóa và cất đồ an toàn. Khi ra về, hoàn tất check-out để trả tủ.
                  </p>
                </div>
              </div>
            </div>

            {/* Guide 3: Dành cho HLV (#guide-coach) */}
            <div
              id="guide-coach"
              className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-5 scroll-mt-28"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-[#17664e] flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Hướng Dẫn Dành Cho HLV</h3>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-600">
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#17664e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </span>
                  <p>
                    <strong className="text-slate-800">Bước 1:</strong> Đăng nhập tài khoản Coach để
                    xem <strong>Lịch dạy hôm nay</strong> và danh sách hội viên phụ trách.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#17664e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </span>
                  <p>
                    <strong className="text-slate-800">Bước 2:</strong> Nhấn{' '}
                    <strong>Điểm danh</strong> khi học viên có mặt và chấm điểm mức độ hoàn thành
                    bài tập.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#17664e] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </span>
                  <p>
                    <strong className="text-slate-800">Bước 3:</strong> Trường hợp đột xuất, gửi{' '}
                    <strong>Yêu cầu hủy lịch khẩn cấp</strong> trước giờ dạy hoặc bấm{' '}
                    <strong>Rút đơn</strong> nếu đã sắp xếp được việc.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. CHÍNH SÁCH & PHÁP LÝ (id="legal" - Cho Menu Dropdown)
          ========================================================================= */}
      <section
        id="legal"
        className="py-24 bg-slate-50/60 border-b border-slate-200/80 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold text-[#17664e] uppercase tracking-wider">
              Minh bạch & Tin cậy
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Chính Sách & Pháp Lý Hoạt Động
            </h2>
            <div className="w-12 h-1 bg-[#17664e] mx-auto rounded-full mt-2" />
            <p className="text-slate-600 text-sm leading-relaxed pt-2">
              Bảo vệ quyền lợi tối đa cho hội viên và duy trì văn hóa tập luyện an toàn, văn minh
              tại trung tâm.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Item 1: Điều khoản Dịch vụ (#terms) */}
            <div
              id="terms"
              className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-28"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <FileText className="w-5 h-5 text-[#17664e]" />
                <h3 className="text-lg font-bold text-slate-900">Điều Khoản Dịch Vụ</h3>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <li>
                  <strong className="text-slate-800">Quy định độ tuổi:</strong> Hội viên từ đủ 16
                  tuổi trở lên có thể tự đăng ký. Hội viên dưới 16 tuổi cần có sự bảo lãnh của phụ
                  huynh hoặc người giám hộ.
                </li>
                <li>
                  <strong className="text-slate-800">Thời hạn hợp đồng:</strong> Các gói tập có giá
                  trị sử dụng trong thời gian quy định (1 ngày đối với Drop-in, 30 ngày đối với
                  Plus/VIP). Quá thời hạn trên, quyền lợi buổi tập chưa dùng sẽ hết hiệu lực trừ
                  trường hợp có đơn bảo lưu hợp lệ.
                </li>
                <li>
                  <strong className="text-slate-800">Quyền từ chối phục vụ:</strong> Trung tâm có
                  quyền chấm dứt gói tập nếu hội viên có hành vi quấy rối, phá hoại tài sản hoặc vi
                  phạm thuần phong mỹ tục.
                </li>
              </ul>
            </div>

            {/* Item 2: Chính sách Bảo mật Thông tin (#privacy) */}
            <div
              id="privacy"
              className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-28"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <ShieldCheck className="w-5 h-5 text-[#17664e]" />
                <h3 className="text-lg font-bold text-slate-900">Chính Sách Bảo Mật</h3>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <li>
                  <strong className="text-slate-800">Thu thập thông tin:</strong> 3TC Fitness chỉ
                  thu thập thông tin cơ bản (Họ tên, SĐT, Email, Hình ảnh khuôn mặt check-in, Chỉ số
                  InBody) phục vụ mục đích nhận diện và thiết lập giáo án.
                </li>
                <li>
                  <strong className="text-slate-800">Cam kết bảo mật:</strong> Mọi mật khẩu và dữ
                  liệu giao dịch thanh toán đều được mã hóa.
                </li>
                <li>
                  <strong className="text-slate-800">Bảo mật tuyệt đối:</strong> Cam kết không chia
                  sẻ hoặc bán dữ liệu của hội viên cho bất kỳ bên thứ ba nào vì mục đích thương mại.
                </li>
              </ul>
            </div>

            {/* Item 3: Quy chế Hủy lịch & Hoàn tiền (#refund-policy) */}
            <div
              id="refund-policy"
              className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-28"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <CreditCard className="w-5 h-5 text-[#17664e]" />
                <h3 className="text-lg font-bold text-slate-900">Quy Chế Hủy Lịch & Hoàn Tiền</h3>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <li>
                  <strong className="text-slate-800">Đổi/Hủy lịch:</strong> Hội viên được quyền hủy
                  trước giờ tập ít nhất 2 tiếng không mất phí và được bảo lưu trọn vẹn số buổi tập.
                </li>
                <li>
                  <strong className="text-slate-800">Chính sách hoàn tiền:</strong> Các gói tập đã
                  kích hoạt và sử dụng không áp dụng hoàn tiền mặt.
                </li>
                <li>
                  <strong className="text-slate-800">Hỗ trợ đặc biệt:</strong> Trường hợp bất khả
                  kháng (chuyển nơi ở, bệnh lý có xác nhận của bác sĩ), hội viên được hỗ trợ chuyển
                  nhượng gói tập cho người thân hoặc bảo lưu tối đa 60 ngày.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. PHẦN CHÂN TRANG (FOOTER - ĐỒNG BỘ MÀU SÁNG GIỐNG NAVBAR)
          ========================================================================= */}
      <footer className="bg-white border-t border-slate-200/90 text-slate-600 pt-16 pb-12 transition-all">
        <div className="w-full px-4 sm:px-8 lg:px-10 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
            {/* Cột 1: Logo & Giới thiệu (4/12) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-2.5 font-bold text-slate-900">
                <img src={logo3tc} alt="3TC FITNESS" className="h-8 md:h-9 w-auto object-contain" />
                <span className="font-black text-lg tracking-tight text-slate-900">
                  3TC <span className="text-[#17664e]">FITNESS</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Hệ thống quản lý và vận hành trung tâm thể thao toàn diện, đồng hành cùng bạn trên
                hành trình chinh phục sức khỏe và vóc dáng lý tưởng.
              </p>
              <div className="pt-2 text-xs space-y-2 text-slate-600">
                <p>
                  📍 <strong>Địa chỉ:</strong> Khu Công Nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh
                </p>
                <p>
                  📞 <strong>Hotline:</strong> 1900 3TC FIT (0901 000 000)
                </p>
                <p>
                  ✉️ <strong>Email:</strong> support@3tcfitness.vn / admin@sportscenter.com
                </p>
                <p>
                  ⏰ <strong>Giờ mở cửa:</strong> Thứ 2 – Chủ Nhật: 05:30 – 22:00
                </p>
              </div>
            </div>

            {/* Cột 2: Liên kết nhanh (4/12) */}
            <div className="lg:col-span-4 space-y-4">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                LIÊN KẾT NHANH
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => scrollToSection('about')}
                  className="text-left text-slate-600 hover:text-[#17664e] transition-colors cursor-pointer"
                >
                  Giới thiệu
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('features')}
                  className="text-left text-slate-600 hover:text-[#17664e] transition-colors cursor-pointer"
                >
                  Tính năng
                </button>
                <Link
                  to="/plans"
                  className="text-left text-slate-600 hover:text-[#17664e] transition-colors cursor-pointer"
                >
                  Bảng giá
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection('faq')}
                  className="text-left text-slate-600 hover:text-[#17664e] transition-colors cursor-pointer"
                >
                  Hỏi đáp
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('terms')}
                  className="text-left text-slate-600 hover:text-[#17664e] transition-colors cursor-pointer"
                >
                  Điều khoản dịch vụ
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('privacy')}
                  className="text-left text-slate-600 hover:text-[#17664e] transition-colors cursor-pointer"
                >
                  Chính sách bảo mật
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('refund-policy')}
                  className="text-left text-slate-600 hover:text-[#17664e] transition-colors cursor-pointer"
                >
                  Quy chế hoàn tiền
                </button>
                <Link
                  to="/portal/member/bookings"
                  className="text-[#17664e] hover:underline font-semibold"
                >
                  Cổng Hội Viên (Member Portal)
                </Link>
              </div>
            </div>

            {/* Cột 3: Đăng ký tư vấn tập thử (4/12) */}
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200/90 p-6 rounded-2xl space-y-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#17664e]" />
                <h4 className="text-sm font-bold text-slate-900 uppercase">
                  NHẬN TƯ VẤN TẬP THỬ 0Đ
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                Để lại số điện thoại để nhận ngay gói trải nghiệm TRIAL 0đ và lịch đo InBody 3D miễn
                phí cùng HLV.
              </p>

              {leadSubmitted ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-[#17664e] mx-auto" />
                  <p className="text-xs font-bold text-emerald-900">Đã gửi thông tin thành công!</p>
                  <p className="text-[11px] text-emerald-700">
                    3TC Fitness sẽ liên hệ tư vấn trong 15 phút.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Họ và tên của bạn"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#17664e] focus:ring-1 focus:ring-[#17664e]"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Số điện thoại liên hệ"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#17664e] focus:ring-1 focus:ring-[#17664e]"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#17664e] hover:bg-[#135641] text-white text-xs font-bold transition-all shadow-md shadow-emerald-700/20 cursor-pointer"
                  >
                    GỬI THÔNG TIN NGAY
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Dải bản quyền dưới cùng */}
          <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© 2026 3TC Fitness Management System. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/auth/login" className="hover:text-[#17664e] transition-colors">
                Đăng Nhập
              </Link>
              <Link to="/auth/register" className="hover:text-[#17664e] transition-colors">
                Đăng Ký
              </Link>
              <Link to="/plans" className="hover:text-[#17664e] transition-colors">
                Bảng Giá Môn Tập
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage

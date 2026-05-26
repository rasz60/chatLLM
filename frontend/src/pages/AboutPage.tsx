import './AboutPage.css';

const SKILL_GROUPS = [
  { label: 'Backend',  items: ['JAVA', 'Spring', 'Spring Boot', 'JPA', 'MyBatis', 'IBatis'] },
  { label: 'Frontend', items: ['React', 'Vue.js', 'Javascript', 'WebSquare'] },
  { label: 'Database', items: ['Oracle', 'MySQL', 'MSSQL'] },
  { label: 'DevOps',   items: ['Git', 'GitLab', 'Docker', 'K8S', 'Openshift PaaS'] },
];

const INTROS = [
  {
    title: '가치와 효율 중심! 진취적 성장형 개발자',
    paragraphs: [
      '약 4년간 사무직으로 회사 생활을 하면서 하나의 프로그램이 업무 효율을 얼마나 높여주는지 체감했습니다. 업무 담당자가 엑셀로 직접 타이핑하던 일을 Excel Parsing / Generator tool로 작업량이 획기적으로 늘어날 수 있게 개선되는 것을 보고, 개발이라는 업무에 큰 흥미를 가지게 되었습니다.',
      '현재는 JAVA, Spring 기반 웹 개발을 주력으로 하며, JPA, React, Vue.js, Docker, Kubernetes, AWS 등 기술 변화에 발맞춰 개인 공부도 꾸준히 하고 있습니다. 이런 점을 눈여겨 보시던 팀장님께서 팀 내에서 한 번도 사용하지 않던 WebSquare 프로젝트에 참여해볼 것을 권하셨고, 이후 총무 업무 포털 재구축, 외부망 연동 프로젝트까지 도맡게 되었습니다.',
    ],
  },
  {
    title: '사회화 잘된 일머리 좋은 개발자',
    paragraphs: [
      '음반 유통사에서 일하며 다양한 이해관계자들과 협업할 기회가 많았습니다. 기획사, 아티스트와의 미팅을 통해 상대방이 원하는 바를 빠르게 파악하고 현실적인 방안을 제시하는 역량을 키울 수 있었고, 이는 개발자로서 현업과 소통하는 데에도 큰 도움이 되었습니다.',
      'ESG 경영 부서 홈페이지 리뉴얼 프로젝트 당시, IT부서와 협업이 처음이신 현업 요청자와 함께 홈페이지 전체 컬러 컨셉부터 화면 배치, 메뉴 구성 변경, 수작업 자동화 등 많은 부분을 개선하며 프로젝트를 성공적으로 마무리하였습니다.',
    ],
  },
];

const EXPERIENCES = [
  {
    period: '2022 – 현재',
    company: '애버커스',
    role: 'Backend Developer',
    desc: '대기업 협력사 사내 그룹웨어 개발/운영',
    details: [
      'JAVA Web 시스템 개발 / 운영',
      'Java, Spring, MyBatis, Javascript, Oracle, MSSQL',
      'RestAPI, SSO Agent 연동, MMS 데몬 수정 개발',
      'GitLab 형상 관리, 실시간 모니터링 (Whatap)',
    ],
  },
  {
    period: '2019 – 2021',
    company: '한국음반산업협회',
    role: '콘텐츠팀 DB 담당',
    desc: '',
    details: ['피지컬 음반 및 메타 정보 시스템 등록 / 관리'],
  },
  {
    period: '2017 – 2019',
    company: '케이디지털미디어',
    role: '음원컨텐츠팀 음원유통담당',
    desc: '',
    details: [
      '피지컬 음반 및 메타 정보 시스템 등록 / 관리',
      '계약사, 플랫폼사와의 음반 발매 및 프로모션 담당',
    ],
  },
];

const PROJECTS = [
  {
    period: '2025.01 – 2025.04',
    title: '업무 시스템 외부망 연동 프로젝트',
    tech: ['JAVA', 'Spring Boot', 'WebSquare', 'Openshift PaaS', 'MyBatis', 'Oracle'],
    items: [
      '사내 정도 경영 시스템과 지주사 정도 경영 시스템 연동 기능 개발',
      '화면 퍼블리싱, 추가 DB 설계, 연동 API 구현',
      '결재 진행에 따른 상태 값 sync 처리',
    ],
    result: ['요구사항 분석 및 설계 중'],
  },
  {
    period: '2024.10 – 2024.12',
    title: '총무 업무 포털 재구축 프로젝트',
    tech: ['JAVA', 'Spring Boot', 'WebSquare', 'Openshift PaaS', 'MyBatis', 'MySQL'],
    items: [
      '사옥별 일일/정기 주차 관리, 업무지원식당 예약 기능 개발',
      '웹, 모바일 사용자/관리자 화면 및 API 개발',
      'AS-IS 데이터 전환 작업 (MSSQL → MySQL)',
    ],
    result: ['담당 기능 포함 진척 미달 기능 개발 지원 (식당 예약)', '프로젝트 오픈 후 전체 메뉴 중 이슈 발생 최저 (1건)'],
  },
  {
    period: '2024.03 – 2024.05',
    title: 'MMS 발송 데몬 개선 개발',
    tech: ['Linux', 'JAVA', 'Oracle'],
    items: [
      '운영 시스템 내 MMS 데몬 정지/지연 현상 조치',
      '발송 G/W와의 socket 통신 시 응답 지연으로 timeout 설정',
      'timeout 시 신규 오류 코드 부여 및 오류 시 처리 로직 구현',
    ],
    result: ['정지 / 지연 현상 100% 해소', 'MMS 데몬 운영 환경 및 형상 관리 추가로 관리 효율 상승'],
  },
  {
    period: '2023.10 – 2024.01',
    title: '서버 전환에 따른 시스템 이관 작업',
    tech: ['JAVA', 'Spring', 'JSP', 'Tomcat', 'iBatis', 'MSSQL', 'PaaS'],
    items: [
      'Windows → Openshift PaaS 서버 전환 작업',
      '형상 관리 툴 전환 및 호환 테스트',
      '서버 초기 설정 및 관리 매뉴얼 작성',
    ],
    result: ['WAS 1개에서 4개 Pod으로 다중화되어 서버 효율 증가', '모니터링 agent 추가로 운영 효율성 20% 증가'],
  },
  {
    period: '2023.09 – 2023.11',
    title: '부서 홈페이지 리뉴얼 작업',
    tech: ['JAVA', 'Spring', 'JSP', 'Tomcat', 'iBatis', 'MSSQL'],
    items: [
      '요청 부서의 요구사항 분석, 도출, 설계 작업',
      '화면/기능 테스트 케이스 수립 및 통합/사용자 테스트 진행',
      '페이지 퍼블리싱부터 API Full-stack 개발',
    ],
    result: ['각 페이지 관리 90% 자동화 (콘텐츠 변경, 위젯 이미지 등)'],
  },
  {
    period: '2023.04 – 2023.07',
    title: '업무 시스템 고도화 프로젝트',
    tech: ['JAVA', 'Spring Boot', 'WebSquare', 'PaaS', 'MyBatis', 'Oracle'],
    items: [
      '결재/게시판 시스템 고도화 및 신규 Dashboard 개발',
      '타 결재 시스템 연동 및 status에 따른 업무 프로세스 개발',
      '시스템 안정성 및 오류 개선',
    ],
    result: ['시스템 고도화 및 Dashboard 추가로 업무 효율 20% 향상', '시스템 오류 99% 개선'],
  },
  {
    period: '2023.02 – 2023.05',
    title: '실시간 티켓 신청 / 추첨 배치 프로그램 제작',
    tech: ['JAVA', 'Spring', 'JSP', 'Tomcat', 'iBatis', 'MSSQL'],
    items: [
      '티켓 신청 - 추첨 자동화 배치 시스템 개발',
      '잔여 티켓 실시간 오픈 및 예약 기능 개발',
      '데이터베이스 정규화 및 최적화',
    ],
    result: ['수동 작업 자동화로 업무 효율 30% 증가', '잔여 티켓 처리율 99%'],
  },
  {
    period: '2022.11 – 2023.02',
    title: '투자 비용 심의 결재 시스템 개발 지원',
    tech: ['JAVA', 'Spring', 'JSP', 'Tomcat', 'iBatis', 'MSSQL'],
    items: [
      '결재 단계 추가로 인한 화면, 데이터 처리 개발',
      '부문별 결재 예외 처리 및 최종 처리 프로세스 개선 개발',
      '타 시스템 TO-DO 완료 처리 누락 건 완료 처리 API 개발',
    ],
    result: ['결재 단계 및 프로세스 개선으로 인한 오류 0건', 'TO-DO 완료처리 누락 건 싱크 처리율 99%'],
  },
];

const EDUCATION = [
  { year: '2024',        school: '솔데스크 학원',           major: 'Docker/K8S 개발자 입문 과정' },
  { year: '2021 – 2022', school: '이젠컴퓨터아카데미화곡', major: '자바 응용 SW 엔지니어 양성 과정' },
  { year: '2006 – 2009', school: '세한대학교',              major: '실용음악과' },
  { year: '2006 – 2009', school: '흥덕고등학교',            major: '인문계열' },
];

const CERTIFICATES = [
  { year: '2024.04',            name: 'SQL개발자 (SQLD)',           issuer: '한국데이터베이스진흥센터' },
  { year: '2021.10 – 2022.04', name: '자바 응용 SW 엔지니어 양성', issuer: '이젠컴퓨터아카데미화곡 (성적우수, 팀 프로젝트 리딩)' },
];

const INTERESTS = [
  {
    icon: 'mdi-cog-sync-outline',
    title: '업무 자동화',
    desc: '업무 프로세스 최적화를 위한 자동화 솔루션 설계 및 구현',
  },
  {
    icon: 'mdi-monitor-dashboard',
    title: 'B2C 플랫폼',
    desc: '사용자 중심 B2C 플랫폼 서비스 개발',
  },
  {
    icon: 'mdi-robot-outline',
    title: 'AI & 모빌리티',
    desc: 'AI, 스마트 모빌리티 시스템 설계 및 구현',
  },
];

export default function AboutPage() {
  return (
    <div className="about-page">

      {/* 히어로 — 중앙 정렬 */}
      <section className="about-hero">
        <div className="about-hero-inner">
          <div className="about-avatar-wrap">
            <img
              className="about-avatar"
              src="https://avatars.githubusercontent.com/u/96821067?v=4"
              alt="김진웅"
            />
          </div>
          <p className="about-role">Backend Developer</p>
          <h1 className="about-name">김진웅</h1>
          <p className="about-tagline">4년 차 회사원에서 3년 차 개발자로, 성장하기 위한 공부도 꾸준히!</p>
          <div className="about-contact-row">
            <span className="about-contact-item">
              <span className="mdi mdi-phone-outline" />
              010-2113-8583
            </span>
            <a className="about-contact-item" href="mailto:devsixt60@gmail.com">
              <span className="mdi mdi-email-outline" />
              devsixt60@gmail.com
            </a>
            <a className="about-contact-item" href="https://github.com/rasz60" target="_blank" rel="noreferrer">
              <span className="mdi mdi-github" />
              github.com/rasz60
            </a>
            <a className="about-contact-item" href="https://rasz60.github.io/sixt/" target="_blank" rel="noreferrer">
              <span className="mdi mdi-post-outline" />
              rasz60.github.io/sixt
            </a>
          </div>
        </div>
      </section>

      <div className="about-body">

        {/* 소개 */}
        <section className="about-section">
          <h2 className="about-section-title">
            <span className="mdi mdi-account-outline about-section-icon" />소개
          </h2>
          <div className="about-intro-cards">
            {INTROS.map((intro, i) => (
              <div key={i} className="about-intro-card">
                <span className="about-intro-num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="about-intro-title">{intro.title}</h3>
                {intro.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
              </div>
            ))}
          </div>
        </section>

        {/* 기술 스택 */}
        <section className="about-section">
          <h2 className="about-section-title">
            <span className="mdi mdi-code-tags about-section-icon" />기술 스택
          </h2>
          <div className="about-skill-groups">
            {SKILL_GROUPS.map(g => (
              <div key={g.label} className="about-skill-group">
                <p className="about-skill-group-label">{g.label}</p>
                <div className="about-skills">
                  {g.items.map(s => <span key={s} className="about-skill-chip">{s}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 경력 */}
        <section className="about-section">
          <h2 className="about-section-title">
            <span className="mdi mdi-briefcase-outline about-section-icon" />경력
          </h2>
          <div className="about-timeline">
            {EXPERIENCES.map((e, i) => (
              <div key={i} className="about-timeline-item">
                <div className="about-timeline-dot" />
                <div className="about-timeline-content">
                  <div className="about-timeline-meta">
                    <span className="about-timeline-period">{e.period}</span>
                    <span className="about-timeline-role">{e.role}</span>
                  </div>
                  <strong className="about-timeline-company">{e.company}</strong>
                  {e.desc && <p className="about-timeline-desc">{e.desc}</p>}
                  <ul className="about-timeline-list">
                    {e.details.map((d, j) => <li key={j}>{d}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 프로젝트 */}
        <section className="about-section">
          <h2 className="about-section-title">
            <span className="mdi mdi-folder-open-outline about-section-icon" />프로젝트
          </h2>
          <div className="about-projects">
            {PROJECTS.map((p, i) => (
              <div key={i} className="about-project-card">
                <div className="about-project-index">{String(i + 1).padStart(2, '0')}</div>
                <div className="about-project-main">
                  <div className="about-project-header">
                    <div>
                      <h3 className="about-project-title">{p.title}</h3>
                      <div className="about-project-tech-chips">
                        {p.tech.map(t => <span key={t} className="about-tech-chip">{t}</span>)}
                      </div>
                    </div>
                    <span className="about-project-period">{p.period}</span>
                  </div>
                  <div className="about-project-body">
                    <div className="about-project-col">
                      <p className="about-project-label">
                        <span className="mdi mdi-clipboard-text-outline" /> 개발 내용
                      </p>
                      <ul>{p.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
                    </div>
                    <div className="about-project-col">
                      <p className="about-project-label">
                        <span className="mdi mdi-check-circle-outline" /> 성과
                      </p>
                      <ul>{p.result.map((r, j) => <li key={j}>{r}</li>)}</ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 교육 + 자격증 — 2열 나란히 */}
        <div className="about-edu-grid">
          <section className="about-section">
            <h2 className="about-section-title">
              <span className="mdi mdi-school-outline about-section-icon" />교육
            </h2>
            <div className="about-education">
              {EDUCATION.map((e, i) => (
                <div key={i} className="about-edu-item">
                  <span className="about-edu-year">{e.year}</span>
                  <div>
                    <strong>{e.school}</strong>
                    <span className="about-edu-major">{e.major}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="about-section">
            <h2 className="about-section-title">
              <span className="mdi mdi-certificate-outline about-section-icon" />자격증 / 수료
            </h2>
            <div className="about-education">
              {CERTIFICATES.map((c, i) => (
                <div key={i} className="about-edu-item">
                  <span className="about-edu-year">{c.year}</span>
                  <div>
                    <strong>{c.name}</strong>
                    <span className="about-edu-major">{c.issuer}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 관심 분야 — 3열 카드 */}
        <section className="about-section">
          <h2 className="about-section-title">
            <span className="mdi mdi-heart-outline about-section-icon" />관심 분야
          </h2>
          <div className="about-interests">
            {INTERESTS.map((item, i) => (
              <div key={i} className="about-interest-card">
                <span className={`mdi ${item.icon} about-interest-icon`} />
                <h4 className="about-interest-title">{item.title}</h4>
                <p className="about-interest-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Crown,
  LayoutDashboard,
  Medal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
  UserMinus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Role = "길드장" | "부길드장" | "정예" | "길드원";
type ContentType = "siege" | "raid" | "war";
type Attendance = "참여" | "불참" | "미기록";
type AttackResult = "승" | "패" | "미기록";

type Member = {
  id: string;
  name: string;
  role: Role;
  joinedAt: string;
  leftAt: string | null;
  defenseSet: boolean;
  defenseUpdatedAt: string | null;
  roleHistory?: { role: Role; changedAt: string }[];
};

type RecordEntry = {
  content: ContentType;
  date: string;
  memberId: string;
  attendance: Attendance;
  attackCount: number;
  attacks: AttackResult[];
  defenseHolds: number;
};

type Season = { id: string; number: number; start: string; end: string };
type GuildData = {
  members: Member[];
  records: RecordEntry[];
  season: Season;
};

const STORAGE_KEY = "senari-guild-manager-v1";
const SEASON_11: Season = {
  id: "season-11",
  number: 11,
  start: "2026-11-12",
  end: "2026-12-23",
};
const NAV_ITEMS = [
  { id: "records", label: "콘텐츠 보드", icon: CalendarDays },
  { id: "overview", label: "대시보드", icon: LayoutDashboard },
  { id: "members", label: "길드원 관리", icon: Users },
  { id: "settings", label: "시즌 · 백업", icon: Settings2 },
] as const;

function makeInitialMembers(): Member[] {
  const roles: Role[] = [
    "길드장",
    "부길드장",
    "부길드장",
    "정예",
    "정예",
    "정예",
    ...Array.from({ length: 24 }, () => "길드원" as Role),
  ];
  return roles.map((role, index) => ({
    id: `member-${index + 1}`,
    name:
      index === 0
        ? "길드장 (나)"
        : role === "부길드장"
          ? `부길드장 ${index - 1}`
          : role === "정예"
            ? `정예 ${index - 2}`
            : `길드원 ${String(index - 5).padStart(2, "0")}`,
    role,
    joinedAt: SEASON_11.start,
    leftAt: null,
    defenseSet: false,
    defenseUpdatedAt: null,
    roleHistory: [{ role, changedAt: `${SEASON_11.start}T00:00:00.000Z` }],
  }));
}

function makeInitialData(): GuildData {
  return {
    members: makeInitialMembers(),
    records: [],
    season: SEASON_11,
  };
}

function dateLabel(value: string) {
  if (!value) return "날짜 선택";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function roleClass(role: Role) {
  if (role === "길드장") return "role-leader";
  if (role === "부길드장") return "role-viceroy";
  if (role === "정예") return "role-elite";
  return "role-member";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function contentName(content: ContentType) {
  return content === "siege" ? "요일별 공성전" : content === "raid" ? "강림원정대" : "길드전";
}

function getEntry(records: RecordEntry[], content: ContentType, date: string, memberId: string) {
  return records.find(
    (entry) => entry.content === content && entry.date === date && entry.memberId === memberId,
  );
}

export default function Home() {
  const [data, setData] = useState<GuildData>(() => makeInitialData());
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"loading" | "synced" | "saving" | "offline">("loading");
  const [activePage, setActivePage] = useState<(typeof NAV_ITEMS)[number]["id"]>("records");
  const [search, setSearch] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const remoteReady = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/data", { cache: "no-store" });
        if (!response.ok) throw new Error(`storage_${response.status}`);
        const result = (await response.json()) as { data: GuildData | null };
        if (cancelled) return;
        if (result.data) {
          setData({
            ...makeInitialData(),
            ...result.data,
            members: Array.isArray(result.data.members) ? result.data.members : makeInitialMembers(),
            records: Array.isArray(result.data.records) ? result.data.records : [],
            season: result.data.season ?? SEASON_11,
          });
        } else {
          setData(makeInitialData());
        }
        remoteReady.current = true;
        setSyncStatus("synced");
      } catch {
        if (cancelled) return;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<GuildData>;
            setData({
              ...makeInitialData(),
              ...parsed,
              members: Array.isArray(parsed.members) ? parsed.members : makeInitialMembers(),
              records: Array.isArray(parsed.records) ? parsed.records : [],
              season: parsed.season ?? SEASON_11,
            });
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
        setSyncStatus("offline");
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (!remoteReady.current) return;
    const timer = window.setTimeout(async () => {
      setSyncStatus("saving");
      try {
        const response = await fetch("/api/data", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(`storage_${response.status}`);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [data, ready]);

  const activeMembers = useMemo(() => data.members.filter((member) => !member.leftAt), [data.members]);
  const inSeason = useMemo(
    () => data.records.filter((entry) => entry.date >= data.season.start && entry.date <= data.season.end),
    [data.records, data.season],
  );
  const siegeCount = inSeason.filter((entry) => entry.content === "siege").length;
  const raidCount = inSeason.filter((entry) => entry.content === "raid").length;
  const warRecords = inSeason.filter((entry) => entry.content === "war");
  const warBattles = new Set(warRecords.map((entry) => entry.date)).size;
  const defenseSetCount = activeMembers.filter((member) => member.defenseSet).length;
  const roleCounts = data.members.reduce(
    (counts, member) => {
      if (!member.leftAt) counts[member.role] += 1;
      return counts;
    },
    { 길드장: 0, 부길드장: 0, 정예: 0, 길드원: 0 } as Record<Role, number>,
  );
  const today = new Date();
  const seasonStart = new Date(`${data.season.start}T00:00:00`);
  const seasonEnd = new Date(`${data.season.end}T23:59:59`);
  const seasonStatus = today < seasonStart ? "시즌 시작 예정" : today > seasonEnd ? "시즌 종료" : "시즌 진행 중";
  const daysUntil = Math.max(0, Math.ceil((seasonStart.getTime() - today.getTime()) / 86400000));
  const seasonProgress = today < seasonStart
    ? 0
    : today > seasonEnd
      ? 100
      : clamp(((today.getTime() - seasonStart.getTime()) / (seasonEnd.getTime() - seasonStart.getTime())) * 100, 0, 100);

  const updateEntry = (content: ContentType, date: string, memberId: string, changes: Partial<RecordEntry>) => {
    setData((current) => {
      const existing = getEntry(current.records, content, date, memberId);
      const base: RecordEntry = existing ?? {
        content,
        date,
        memberId,
        attendance: "미기록",
        attackCount: 0,
        attacks: ["미기록", "미기록", "미기록"],
        defenseHolds: 0,
      };
      const next = { ...base, ...changes };
      const records = existing
        ? current.records.map((entry) =>
            entry.content === content && entry.date === date && entry.memberId === memberId
              ? next
              : entry,
          )
        : [...current.records, next];
      return { ...current, records };
    });
  };



  const updateMember = (id: string, changes: Partial<Member>) => {
    setData((current) => ({
      ...current,
      members: current.members.map((member) => {
        if (member.id !== id) return member;
        const roleHistory =
          changes.role && changes.role !== member.role
            ? [...(member.roleHistory ?? []), { role: changes.role, changedAt: new Date().toISOString() }]
            : member.roleHistory;
        return { ...member, ...changes, roleHistory };
      }),
    }));
  };

  const changeRole = (member: Member, role: Role) => {
    if (role === member.role) return;
    const roleLimit: Partial<Record<Role, number>> = { 길드장: 1, 부길드장: 2, 정예: 3 };
    if (roleLimit[role] !== undefined && roleCounts[role] >= roleLimit[role]!) {
      window.alert(`${role} 직위는 최대 ${roleLimit[role]}명까지 지정할 수 있어요.`);
      return;
    }
    updateMember(member.id, { role });
  };

  const addMember = () => {
    const nextNumber = data.members.length + 1;
    const member: Member = {
      id: `member-${Date.now()}`,
      name: `새 길드원 ${String(nextNumber).padStart(2, "0")}`,
      role: "길드원",
      joinedAt: new Date().toISOString().slice(0, 10),
      leftAt: null,
      defenseSet: false,
      defenseUpdatedAt: null,
    };
    setData((current) => ({ ...current, members: [...current.members, member] }));
  };

  const markLeft = (member: Member) => {
    if (member.role === "길드장") return;
    if (!window.confirm(`${member.name}님을 탈퇴 처리할까요? 기존 기록은 보관됩니다.`)) return;
    const leftAt = new Date().toISOString().slice(0, 10);
    updateMember(member.id, { leftAt });
  };

  const updateDefense = (member: Member, defenseSet: boolean) => {
    updateMember(member.id, {
      defenseSet,
      defenseUpdatedAt: new Date().toISOString(),
    });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `세나리-길드관리-시즌${data.season.number}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as GuildData;
      if (!Array.isArray(parsed.members) || !Array.isArray(parsed.records) || !parsed.season) {
        throw new Error("invalid backup");
      }
      setData({ ...makeInitialData(), ...parsed });
    } catch {
      window.alert("백업 파일을 읽지 못했어요. 길드 관리에서 내보낸 JSON 파일인지 확인해 주세요.");
    }
  };

  const createNextSeason = () => {
    const nextNumber = data.season.number + 1;
    const nextStartDate = new Date(`${data.season.start}T12:00:00`);
    nextStartDate.setDate(nextStartDate.getDate() + 49);
    const nextEndDate = new Date(nextStartDate);
    nextEndDate.setDate(nextEndDate.getDate() + 41);
    const toIso = (date: Date) => date.toISOString().slice(0, 10);
    setData((current) => ({
      ...current,
      season: {
        id: `season-${nextNumber}`,
        number: nextNumber,
        start: toIso(nextStartDate),
        end: toIso(nextEndDate),
      },
    }));
  };

  const filteredMembers = activeMembers.filter((member) =>
    `${member.name} ${member.role}`.toLowerCase().includes(search.toLowerCase()),
  );



  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><ShieldCheck size={20} strokeWidth={2.5} /></div>
          <div>
            <p className="brand-title">SENARI</p>
            <p className="brand-subtitle">GUILD OFFICE</p>
          </div>
        </div>

        <div className="guild-switcher">
          <div className="guild-emblem">S</div>
          <div className="guild-name-wrap"><strong>세나리</strong><span>길드 운영실</span></div>
          <ChevronDown size={15} className="muted" />
        </div>

        <p className="nav-caption">관리 메뉴</p>
        <nav className="main-nav" aria-label="주요 메뉴">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${activePage === id ? "active" : ""}`} onClick={() => setActivePage(id)}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {id === "records" && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="season-mini-card">
          <div className="season-mini-top"><span className="live-dot" /> 시즌 {data.season.number} <span>운영 중</span></div>
          <strong>{dateLabel(data.season.start)} — {dateLabel(data.season.end)}</strong>
          <div className="mini-progress"><span style={{ width: `${seasonProgress}%` }} /></div>
        </div>
        <button className="profile-button" onClick={exportData} title="길드 데이터 백업 내보내기">
          <div className="profile-avatar"><Crown size={16} /></div>
          <div className="profile-copy"><strong>길드장</strong><span>데이터 백업</span></div>
          <ArrowDownToLine size={16} className="muted" />
        </button>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>세나리</span><span className="crumb-divider">/</span><strong>{NAV_ITEMS.find((item) => item.id === activePage)?.label}</strong></div>
          <div className="topbar-actions">
            <div className="season-select"><span className="season-select-dot" /> 시즌 {data.season.number}<ChevronDown size={14} /></div>
            <span className="topbar-divider" />
            <div className="topbar-date"><CalendarDays size={15} /> {new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(today)}</div>
            <span className={`sync-pill ${syncStatus}`}><span />{syncStatus === "loading" ? "불러오는 중" : syncStatus === "saving" ? "저장 중" : syncStatus === "synced" ? "로컬 DB 저장됨" : "기기 임시 저장"}</span>
            <button className="avatar-button" title="길드장 프로필">길</button>
          </div>
        </header>

        <div className="content-wrap">
          {syncStatus === "offline" && <div className="sync-warning"><span className="warning-mark">!</span><span>서버 저장에 연결되지 않아 현재 기기에 임시 보관 중입니다. </span><a href="/signin-with-chatgpt?return_to=%2F" target="_top">다시 로그인</a></div>}
          {activePage === "overview" && (
            <>
              <div className="page-heading heading-row">
                <div>
                  <p className="eyebrow">GUILD COMMAND CENTER <span>·</span> SEASON {data.season.number}</p>
                  <h1>길드 운영 현황</h1>
                  <p className="heading-description">이번 시즌의 참여와 성과를 한눈에 확인하세요.</p>
                </div>
                <button className="primary-button" onClick={() => setActivePage("records")}><Plus size={17} /> 참여 기록 열기</button>
              </div>

              <section className="season-banner">
                <div className="banner-orbit orbit-one" /><div className="banner-orbit orbit-two" />
                <div className="banner-content">
                  <div className="banner-kicker"><span className="banner-star">✦</span> CURRENT SEASON <span className="banner-status">{seasonStatus}</span></div>
                  <h2>시즌 {data.season.number}<span className="banner-dash">/</span> 길드의 기록을 쌓아가요</h2>
                  <p>{dateLabel(data.season.start)}부터 {dateLabel(data.season.end)}까지 · 길드전 전투 18회</p>
                  <div className="banner-meta"><span><CalendarDays size={15} /> {data.season.start.replaceAll("-", ".")} — {data.season.end.replaceAll("-", ".")}</span><i /><span><Users size={15} /> 현재 {activeMembers.length}명 활동 중</span></div>
                </div>
                <div className="banner-medallion"><div><Swords size={26} /><span>XI</span></div><small>GUILD WAR</small></div>
              </section>

              <section className="stats-grid">
                <StatCard icon={<Users size={17} />} label="활동 길드원" value={`${activeMembers.length}`} suffix="명" detail={`길드장 ${roleCounts["길드장"]} · 부길드장 ${roleCounts["부길드장"]} · 정예 ${roleCounts["정예"]}`} tone="blue" />
                <StatCard icon={<Activity size={17} />} label="시즌 기록" value={`${inSeason.length}`} suffix="건" detail={`공성전 ${siegeCount} · 강림원정대 ${raidCount} · 길드전 ${warRecords.length}`} tone="violet" />
                <StatCard icon={<ShieldCheck size={17} />} label="방어성 설정" value={`${defenseSetCount}`} suffix={`/ ${activeMembers.length}`} detail={`${activeMembers.length - defenseSetCount}명 설정 확인 필요`} tone="amber" />
                <StatCard icon={<Swords size={17} />} label="길드전 전투 기록" value={`${warBattles}`} suffix="/ 18" detail="시즌 전투일별 기록 현황" tone="green" />
              </section>

              <div className="dashboard-grid">
                <section className="panel activity-panel">
                  <div className="panel-heading"><div><p className="section-kicker">SEASON TRACKER</p><h3>콘텐츠별 기록 현황</h3></div><button className="text-button" onClick={() => setActivePage("records")}>기록 관리 <ArrowUpRight size={14} /></button></div>
                  <div className="content-trackers">
                    <TrackerRow icon={<Swords size={17} />} iconClass="tracker-blue" title="요일별 공성전" subtitle="매일 참여와 성과 기록" count={siegeCount} unit="건" percent={Math.min(100, Math.round((siegeCount / (activeMembers.length * 42)) * 100))} />
                    <TrackerRow icon={<Activity size={17} />} iconClass="tracker-purple" title="강림원정대" subtitle="2주 주기 참여와 성과 기록" count={raidCount} unit="건" percent={Math.min(100, Math.round((raidCount / (activeMembers.length * 3)) * 100))} />
                    <TrackerRow icon={<ShieldCheck size={17} />} iconClass="tracker-amber" title="길드전 전투" subtitle="토 · 월 · 수 · 총 18회" count={warBattles} unit="일" percent={Math.round((warBattles / 18) * 100)} />
                  </div>
                  <div className="panel-footer-note"><span className="note-mark">i</span> 미기록과 불참은 서로 다른 상태로 저장됩니다.</div>
                </section>

                <section className="panel quick-panel">
                  <div className="panel-heading"><div><p className="section-kicker">NEXT UP</p><h3>시즌 일정</h3></div><CalendarDays size={18} className="muted" /></div>
                  <div className="next-event-card">
                    <div className="event-date-tile"><b>12</b><span>11월</span></div>
                    <div className="next-event-copy"><span className="event-type-tag">시즌 11 시작</span><strong>길드전 시즌 시작</strong><small>목요일 · 휴전일</small></div>
                    <span className="event-countdown">{daysUntil === 0 ? "오늘" : `${daysUntil}일 후`}</span>
                  </div>
                  <div className="mini-schedule">
                    <div><span className="schedule-dot prep" /> 준비일 <small>금 · 일 · 화</small></div>
                    <div><span className="schedule-dot battle" /> 전투일 <small>토 · 월 · 수</small></div>
                  </div>
                  <button className="outline-button full-button" onClick={() => setActivePage("records")}>콘텐츠 보드에서 방어 상태 확인 <ArrowUpRight size={15} /></button>
                </section>
              </div>

              <div className="page-bottom-note"><CircleHelp size={14} /> 모든 데이터는 이 브라우저에 저장돼요. 정기적으로 백업 파일을 내려받아 주세요.</div>
            </>
          )}

          {activePage === "members" && (
            <>
              <div className="page-heading heading-row">
                <div><p className="eyebrow">ROSTER MANAGEMENT</p><h1>길드원 관리</h1><p className="heading-description">가입과 직위 변경을 관리하고 시즌 기록을 이어가세요.</p></div>
                <button className="primary-button" onClick={addMember}><Plus size={17} /> 길드원 추가</button>
              </div>
              <section className="roster-summary-grid">
                {(["길드장", "부길드장", "정예", "길드원"] as Role[]).map((role) => <div className="roster-summary-card" key={role}><span className={`role-dot ${roleClass(role)}`} /><span>{role}</span><strong>{roleCounts[role]}</strong></div>)}
              </section>
              <section className="panel roster-panel">
                <div className="panel-heading roster-heading"><div><p className="section-kicker">ACTIVE ROSTER</p><h3>활동 길드원 <span className="heading-count">{activeMembers.length}</span></h3></div><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름 또는 직위 검색" /></label></div>
                <div className="table-scroll"><table className="data-table member-table"><thead><tr><th>길드원</th><th>직위</th><th>가입일</th><th>방어성</th><th>시즌 기록</th><th><span className="sr-only">관리</span></th></tr></thead><tbody>
                  {filteredMembers.map((member) => {
                    const memberRecordCount = inSeason.filter((entry) => entry.memberId === member.id).length;
                    return <tr key={member.id}><td><div className="member-cell"><MemberAvatar name={member.name} role={member.role} /><input className="member-name-input" value={member.name} onChange={(event) => updateMember(member.id, { name: event.target.value })} aria-label="길드원 이름" /></div></td><td><select className={`role-select ${roleClass(member.role)}`} value={member.role} onChange={(event) => changeRole(member, event.target.value as Role)}>{(["길드장", "부길드장", "정예", "길드원"] as Role[]).map((role) => <option key={role}>{role}</option>)}</select></td><td className="muted-cell">{member.joinedAt}</td><td><span className={`status-chip ${member.defenseSet ? "status-good" : "status-pending"}`}><span />{member.defenseSet ? "설정 완료" : "미설정"}</span></td><td><strong className="record-count">{memberRecordCount}</strong><span className="muted-cell"> 건</span></td><td><button className="leave-button" onClick={() => markLeft(member)} disabled={member.role === "길드장"} title="탈퇴 처리"><UserMinus size={14} /><span>탈퇴</span></button></td></tr>;
                  })}
                </tbody></table></div>
                <div className="table-footnote">이름과 직위 변경은 자동 저장됩니다. 탈퇴 처리는 기록을 보존한 채 활동 명단에서 분리해요.</div>
              </section>
              {data.members.some((member) => member.leftAt) && <section className="panel departed-panel"><div className="panel-heading"><div><p className="section-kicker">HISTORY</p><h3>이전 길드원</h3></div><span className="history-count">{data.members.filter((member) => member.leftAt).length}명</span></div><div className="departed-list">{data.members.filter((member) => member.leftAt).map((member) => <div className="departed-row" key={member.id}><MemberAvatar name={member.name} role={member.role} /><strong>{member.name}</strong><span>{member.role}</span><small>{member.leftAt} 탈퇴</small><button className="restore-button" onClick={() => updateMember(member.id, { leftAt: null })}>복귀</button></div>)}</div></section>}
            </>
          )}

          {activePage === "records" && <ParticipationBoard members={activeMembers} records={data.records} season={data.season} syncStatus={syncStatus} onUpdateEntry={updateEntry} onUpdateDefense={updateDefense} />}

          {activePage === "settings" && (
            <>
              <div className="page-heading heading-row"><div><p className="eyebrow">SEASON CONFIGURATION</p><h1>시즌 · 백업</h1><p className="heading-description">시즌 기간과 로컬 데이터를 관리하세요.</p></div><button className="outline-button" onClick={createNextSeason}><Plus size={16} /> 다음 시즌 만들기</button></div>
              <section className="panel season-settings-panel"><div className="panel-heading"><div><p className="section-kicker">ACTIVE SEASON</p><h3>시즌 {data.season.number} 기간</h3></div><span className={`season-state ${seasonStatus === "시즌 진행 중" ? "state-live" : ""}`}><span />{seasonStatus}</span></div><div className="season-date-grid"><label><span>시작일</span><input type="date" value={data.season.start} onChange={(event) => setData((current) => ({ ...current, season: { ...current.season, start: event.target.value } }))} /></label><div className="date-range-arrow">→</div><label><span>종료일</span><input type="date" value={data.season.end} onChange={(event) => setData((current) => ({ ...current, season: { ...current.season, end: event.target.value } }))} /></label></div><div className="season-note"><span className="note-mark">i</span> 시즌 11은 6주 진행, 길드전 전투일은 18회입니다. 다음 1주 휴식 기간은 시즌 종료 후 이어집니다.</div></section>
              <section className="panel data-tools-panel"><div className="panel-heading"><div><p className="section-kicker">DATA & BACKUP</p><h3>데이터 백업 및 복원</h3><p className="panel-subtitle">기록은 이 컴퓨터의 로컬 DB에 저장됩니다. 다른 컴퓨터로 옮길 때 JSON 백업을 사용하세요.</p></div><div className="backup-icon"><ArrowDownToLine size={18} /></div></div><div className="backup-actions"><button className="outline-button" onClick={exportData}><ArrowDownToLine size={16} /> JSON 백업 다운로드</button><button className="outline-button" onClick={() => fileInput.current?.click()}><ArrowUpRight size={16} /> 백업 파일 불러오기</button><input ref={fileInput} type="file" accept="application/json,.json" className="hidden-input" onChange={(event) => { void importData(event.target.files?.[0]); event.currentTarget.value = ""; }} /></div></section>
            </>
          )}
        </div>

        <footer className="app-footer"><span>© 2026 SENARI GUILD OFFICE</span><span>시즌 {data.season.number} · {syncStatus === "synced" ? "로컬 DB 저장" : "기기 임시 저장"} <span className="footer-dot" /></span></footer>
      </section>
    </main>
  );
}

type BoardFilter = "all" | ContentType;
type WarEditorTarget = { memberId: string; date: string } | null;

function mondayOf(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function shiftDate(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function warPhase(dateKey: string, season: Season): "prep" | "battle" | null {
  if (dateKey < season.start || dateKey > season.end) return null;
  const weekday = new Date(`${dateKey}T12:00:00`).getDay();
  if ([5, 0, 2].includes(weekday)) return "prep";
  if ([6, 1, 3].includes(weekday)) return "battle";
  return null;
}

function cycleAttendance(value: Attendance | undefined): Attendance {
  if (!value || value === "미기록") return "참여";
  if (value === "참여") return "불참";
  return "미기록";
}

function ParticipationBoard({
  members,
  records,
  season,
  syncStatus,
  onUpdateEntry,
  onUpdateDefense,
}: {
  members: Member[];
  records: RecordEntry[];
  season: Season;
  syncStatus: "loading" | "synced" | "saving" | "offline";
  onUpdateEntry: (content: ContentType, date: string, memberId: string, changes: Partial<RecordEntry>) => void;
  onUpdateDefense: (member: Member, defenseSet: boolean) => void;
}) {
  const [periodStart, setPeriodStart] = useState(() => mondayOf(SEASON_11.start));
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [warEditor, setWarEditor] = useState<WarEditorTarget>(null);
  const dates = useMemo(() => Array.from({ length: 14 }, (_, index) => shiftDate(periodStart, index)), [periodStart]);
  const periodEnd = dates[13];
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dateRecords = records.filter((entry) => entry.date >= periodStart && entry.date <= periodEnd);
  const siegeMarked = dateRecords.filter((entry) => entry.content === "siege" && entry.attendance !== "미기록").length;
  const raidMarked = records.filter((entry) => entry.content === "raid" && entry.date === periodStart && entry.attendance !== "미기록").length;
  const warMarked = dateRecords.filter((entry) => entry.content === "war" && (entry.attendance !== "미기록" || entry.attackCount > 0 || entry.defenseHolds > 0)).length;
  const editorMember = warEditor ? members.find((member) => member.id === warEditor.memberId) : undefined;
  const editorEntry = warEditor ? getEntry(records, "war", warEditor.date, warEditor.memberId) : undefined;
  const editorAttackCount = editorEntry?.attackCount ?? 0;

  const saveAttendance = (content: ContentType, date: string, member: Member) => {
    const entry = getEntry(records, content, date, member.id);
    onUpdateEntry(content, date, member.id, { attendance: cycleAttendance(entry?.attendance) });
  };

  const dateCellEvents = (member: Member, date: string) => {
    const items: React.ReactNode[] = [];
    if (filter === "all" || filter === "siege") {
      const entry = getEntry(records, "siege", date, member.id);
      items.push(
        <CalendarEventButton
          key="siege"
          label="공성"
          attendance={entry?.attendance}
          kind="siege"
          onClick={() => saveAttendance("siege", date, member)}
        />,
      );
    }
    if ((filter === "all" || filter === "raid") && date === periodStart) {
      const entry = getEntry(records, "raid", periodStart, member.id);
      items.push(
        <CalendarEventButton
          key="raid"
          label="강림"
          attendance={entry?.attendance}
          kind="raid"
          title={`강림원정대 ${dateLabel(periodStart)}부터 2주 주기 참여`}
          onClick={() => saveAttendance("raid", periodStart, member)}
        />,
      );
    }
    const phase = warPhase(date, season);
    if ((filter === "all" || filter === "war") && phase === "prep") {
      items.push(
        <button
          key="war-prep"
          className={`calendar-event war-prep ${member.defenseSet ? "event-set" : "event-unset"}`}
          title="방어성 설정 상태는 수정할 때까지 유지됩니다"
          onClick={() => onUpdateDefense(member, !member.defenseSet)}
        >
          <span className="event-short">방어</span><span className="event-state">{member.defenseSet ? "설정" : "미설정"}</span>
        </button>,
      );
    }
    if ((filter === "all" || filter === "war") && phase === "battle") {
      const entry = getEntry(records, "war", date, member.id);
      const hasDetails = entry && (entry.attendance !== "미기록" || entry.attackCount > 0 || entry.defenseHolds > 0);
      items.push(
        <button
          key="war-battle"
          className={`calendar-event war-battle ${hasDetails ? "event-recorded" : ""}`}
          title={`${dateLabel(date)} 길드전 전투 기록 열기`}
          onClick={() => setWarEditor({ memberId: member.id, date })}
        >
          <span className="event-short">전투</span><span className="event-state">{hasDetails ? "기록" : "입력"}</span>
        </button>,
      );
    }
    return <div className="calendar-event-stack">{items.length ? items : <span className="calendar-empty">—</span>}</div>;
  };

  const changePeriod = (delta: number) => setPeriodStart((current) => shiftDate(current, delta * 14));

  return (
    <>
      <div className="page-heading board-heading">
        <div><p className="eyebrow">TWO-WEEK CONTENT BOARD</p><h1>콘텐츠 참여 보드</h1><p className="heading-description">날짜별 표에서 공성전·강림원정대·길드전 상태를 바로 기록하세요.</p></div>
        <span className={`saved-indicator ${syncStatus}`}><span />{syncStatus === "saving" ? "저장 중" : syncStatus === "synced" ? "로컬 저장됨" : syncStatus === "loading" ? "불러오는 중" : "기기 임시 저장"}</span>
      </div>

      <div className="board-toolbar">
        <div className="period-navigation">
          <button className="period-arrow" onClick={() => changePeriod(-1)} aria-label="이전 2주"><ChevronLeft size={17} /></button>
          <div className="period-copy"><strong>{dateLabel(periodStart)} — {dateLabel(periodEnd)}</strong><span>2주 단위 · 월요일 시작</span></div>
          <button className="period-arrow" onClick={() => changePeriod(1)} aria-label="다음 2주"><ChevronRight size={17} /></button>
          <label className="period-date-input"><CalendarDays size={15} /><input type="date" value={periodStart} onChange={(event) => { if (event.target.value) setPeriodStart(mondayOf(event.target.value)); }} /></label>
        </div>
        <div className="board-filter" role="tablist" aria-label="콘텐츠 필터">
          {([
            ["all", "전체", dateRecords.filter((entry) => entry.attendance !== "미기록" || entry.attackCount > 0 || entry.defenseHolds > 0).length],
            ["siege", "공성전", siegeMarked],
            ["raid", "강림원정대", raidMarked],
            ["war", "길드전", warMarked],
          ] as [BoardFilter, string, number][]).map(([key, label, count]) => (
            <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? "selected" : ""} onClick={() => setFilter(key)}>{label}<small>{count}</small></button>
          ))}
        </div>
      </div>

      <div className="board-notes">
        <span><span className="legend-dot siege-dot" />공성전은 매일 기록</span>
        <span><span className="legend-dot raid-dot" />강림은 첫 월요일에 2주 주기 기록</span>
        <span><span className="legend-dot war-dot" />준비일 방어 상태는 수정 전까지 유지</span>
        <span className="no-score-note">현재 점수는 기록하지 않습니다.</span>
      </div>

      <section className="panel calendar-panel">
        <div className="calendar-table-scroll">
          <table className="calendar-table">
            <thead>
              <tr>
                <th className="calendar-member-head" rowSpan={2}>길드원 <span>{members.length}명</span></th>
                <th className="week-group" colSpan={7}>1주차 <small>{dateLabel(dates[0])} — {dateLabel(dates[6])}</small></th>
                <th className="week-group" colSpan={7}>2주차 <small>{dateLabel(dates[7])} — {dateLabel(dates[13])}</small></th>
              </tr>
              <tr>
                {dates.map((date) => {
                  const phase = warPhase(date, season);
                  const weekday = new Date(`${date}T12:00:00`).getDay();
                  return <th className={`date-head ${weekday === 0 || weekday === 6 ? "weekend" : ""}`} key={date}><strong>{days[weekday]}</strong><span>{date.slice(5, 7)}/{date.slice(8)}</span>{phase && <small className={phase === "battle" ? "battle-day-label" : "prep-day-label"}>{phase === "battle" ? "전투" : "준비"}</small>}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className={member.leftAt ? "inactive-row" : ""}>
                  <th className="calendar-member-cell"><MemberAvatar name={member.name} role={member.role} /><span><strong>{member.name}</strong><small>{member.role}</small></span></th>
                  {dates.map((date) => <td key={`${member.id}-${date}`} className="calendar-day-cell">{member.leftAt ? <span className="calendar-empty">탈퇴</span> : dateCellEvents(member, date)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="calendar-footer"><span>버튼을 누르면 <strong>미기록 → 참여 → 불참 → 미기록</strong> 순으로 바뀝니다.</span><span>길드전 전투 버튼을 눌러 공격·수비 상세를 입력하세요.</span></div>
      </section>

      {warEditor && editorMember && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setWarEditor(null)}>
          <section className="war-editor-card" role="dialog" aria-modal="true" aria-labelledby="war-editor-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="war-editor-heading"><div><p className="section-kicker">GUILD WAR BATTLE</p><h2 id="war-editor-title">{editorMember.name}<span> · {dateLabel(warEditor.date)}</span></h2></div><button className="close-button" onClick={() => setWarEditor(null)} aria-label="닫기"><X size={17} /></button></div>
            <div className="war-editor-field"><span>전투 참여</span><button className={`attendance-pill ${editorEntry?.attendance === "참여" ? "is-present" : editorEntry?.attendance === "불참" ? "is-absent" : "is-empty"}`} onClick={() => onUpdateEntry("war", warEditor.date, editorMember.id, { attendance: cycleAttendance(editorEntry?.attendance) })}>{editorEntry?.attendance ?? "미기록"}</button></div>
            <div className="war-editor-field attack-field"><span>공격권 사용 <small>최대 3회</small></span><select className="count-select" value={editorAttackCount} onChange={(event) => { const count = Number(event.target.value); const attacks = Array.from({ length: 3 }, (_, index) => index < count ? editorEntry?.attacks[index] ?? "미기록" : "미기록") as AttackResult[]; onUpdateEntry("war", warEditor.date, editorMember.id, { attackCount: count, attacks }); }}><option value={0}>0회</option><option value={1}>1회</option><option value={2}>2회</option><option value={3}>3회</option></select></div>
            {editorAttackCount > 0 && <div className="attack-outcome-list">{Array.from({ length: editorAttackCount }, (_, index) => { const result = editorEntry?.attacks[index] ?? "미기록"; return <div className="attack-outcome-row" key={index}><span>{index + 1}번째 공격</span><div><button className={`outcome-button ${result === "승" ? "win" : ""}`} onClick={() => { const attacks = [...(editorEntry?.attacks ?? ["미기록", "미기록", "미기록"])]; attacks[index] = result === "승" ? "미기록" : "승"; onUpdateEntry("war", warEditor.date, editorMember.id, { attacks }); }}>승리</button><button className={`outcome-button ${result === "패" ? "loss" : ""}`} onClick={() => { const attacks = [...(editorEntry?.attacks ?? ["미기록", "미기록", "미기록"])]; attacks[index] = result === "패" ? "미기록" : "패"; onUpdateEntry("war", warEditor.date, editorMember.id, { attacks }); }}>패배</button></div></div>; })}</div>}
            <div className="war-editor-field"><span>방어 수비 횟수</span><div className="stepper"><button onClick={() => onUpdateEntry("war", warEditor.date, editorMember.id, { defenseHolds: Math.max(0, (editorEntry?.defenseHolds ?? 0) - 1) })}>−</button><strong>{editorEntry?.defenseHolds ?? 0}</strong><button onClick={() => onUpdateEntry("war", warEditor.date, editorMember.id, { defenseHolds: (editorEntry?.defenseHolds ?? 0) + 1 })}>+</button></div></div>
            <p className="editor-note">참여, 공격 승패, 수비 횟수만 기록합니다. 점수 입력은 없습니다.</p>
          </section>
        </div>
      )}
    </>
  );
}

function CalendarEventButton({ label, attendance, kind, onClick, title }: { label: string; attendance?: Attendance; kind: "siege" | "raid"; onClick: () => void; title?: string }) {
  const status = attendance ?? "미기록";
  return <button className={`calendar-event ${kind} ${status === "참여" ? "event-attended" : status === "불참" ? "event-absent" : "event-unmarked"}`} title={title ?? `${label}: ${status}`} onClick={onClick}><span className="event-short">{label}</span><span className="event-state">{status === "참여" ? "✓" : status === "불참" ? "×" : "·"}</span></button>;
}

function StatCard({ icon, label, value, suffix, detail, tone, compact = false }: { icon: React.ReactNode; label: string; value: string; suffix: string; detail: string; tone: string; compact?: boolean }) {
  return <div className={`stat-card tone-${tone}`}><div className="stat-top"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><ArrowUpRight size={14} className="stat-arrow" /></div><div className={`stat-value ${compact ? "stat-value-compact" : ""}`}>{value}<small>{suffix}</small></div><p className="stat-detail">{detail}</p></div>;
}

function TrackerRow({ icon, iconClass, title, subtitle, count, unit, percent }: { icon: React.ReactNode; iconClass: string; title: string; subtitle: string; count: number; unit: string; percent: number }) {
  return <div className="tracker-row"><span className={`tracker-icon ${iconClass}`}>{icon}</span><div className="tracker-main"><div className="tracker-title-line"><strong>{title}</strong><span>{count}<small> {unit}</small></span></div><p>{subtitle}</p><div className="tracker-progress"><span style={{ width: `${percent}%` }} /></div></div></div>;
}

function MemberAvatar({ name, role }: { name: string; role: Role }) {
  return <span className={`member-avatar ${roleClass(role)}`}>{name.trim().slice(0, 1) || "?"}</span>;
}

function EmptyState({ title, detail, action, onClick }: { title: string; detail: string; action: string; onClick: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><Trophy size={21} /></div><strong>{title}</strong><p>{detail}</p><button className="outline-button" onClick={onClick}>{action} <ArrowUpRight size={14} /></button></div>;
}

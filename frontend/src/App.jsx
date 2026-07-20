import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'
const API_ROOT = API_BASE.endsWith('/api') ? API_BASE.slice(0, -4) : API_BASE

const paymentMethodLabels = {
  CARD: 'Credit Card',
  PAYNOW: 'PayNow',
  GRABPAY: 'GrabPay',
  APPLEPAY: 'Apple Pay',
}

const defaultPayment = {
  method: 'CARD',
  cardHolder: '',
  cardNumber: '',
  expiryDate: '',
  cvv: '',
  payNowNumber: '',
  walletId: '',
}

const defaultPasswordForm = {
  currentPassword: '',
  newPassword: '',
}

const initialEvents = [
  {
    id: 'nus-freshers-night',
    title: 'NUS Freshers Night 2026',
    venue: 'University Cultural Centre',
    dateLabel: 'Fri, 28 Aug 2026, 7:30 PM',
    releaseStart: '2026-07-25T09:00',
    pricing: {
      festival: 98,
      vip: 288,
      group1: 188,
      group2: 128,
    },
    openGroups: {
      festival: true,
      vip: true,
      group1: true,
      group2Left: true,
      group2Right: true,
    },
    seats: {
      festival: 300,
      vip: 100,
      group1: 200,
      group2Left: 500,
      group2Right: 500,
    },
  },
]

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function summarizeCartItems(items) {
  const groups = new Map()

  items.forEach((item) => {
    const zoneId = item.zoneId ?? item.zoneLabel ?? 'unknown'
    const zoneLabel = item.zoneLabel ?? item.label
    const group = groups.get(zoneId) ?? {
      key: zoneId,
      label: zoneLabel,
      count: 0,
      detail: zoneId === 'FESTIVAL' || zoneLabel === 'Festival' ? 'Standing passes' : 'Reserved seats',
      total: 0,
      seats: [],
    }

    group.count += 1
    group.total += item.price
    group.seats.push(item.label)
    groups.set(zoneId, group)
  })

  return Array.from(groups.values()).map((group) => ({
    ...group,
    label: `${group.label} x${group.count}`,
  }))
}

function getZoneAvailability(zone) {
  const availableCount = zone.seats.filter((seat) => seat.status === 'AVAILABLE').length
  const heldCount = zone.seats.filter((seat) => seat.status === 'HELD').length
  const soldCount = zone.seats.filter((seat) => seat.status === 'SOLD').length

  return {
    totalCount: zone.seats.length,
    availableCount,
    heldCount,
    soldCount,
  }
}

function getZoneMapClass(zoneId) {
  switch (zoneId) {
    case 'FESTIVAL':
      return 'map-festival'
    case 'VIP':
      return 'map-vip'
    case 'GROUP1':
      return 'map-group1'
    case 'GROUP2_LEFT':
      return 'map-group2-left'
    case 'GROUP2_RIGHT':
      return 'map-group2-right'
    default:
      return ''
  }
}

function getStoredSession() {
  const rawSession = window.localStorage.getItem('sgbooked-session')

  if (!rawSession) {
    return null
  }

  try {
    return JSON.parse(rawSession)
  } catch {
    return null
  }
}

async function apiRequest(path, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.detail ?? 'Request failed.')
  }

  return payload
}

function VerificationModal({
  challenge,
  answer,
  setAnswer,
  onSubmit,
  busy,
  onClose,
  title,
  description,
}) {
  if (!challenge) {
    return null
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Human verification">
      <section className="modal-card">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Human Verification</span>
            <h3>{title}</h3>
          </div>
          {onClose && (
            <button type="button" className="icon-button" onClick={onClose}>
              Close
            </button>
          )}
        </div>
        <p className="muted copy-block">{description}</p>
        <p className="challenge-prompt">{challenge.prompt}</p>

        <div className="image-grid">
          {challenge.tiles.map((tile) => {
            const imageUrl = `${API_ROOT}${tile.imageUrl}`
            return (
              <div
                key={tile.tileNumber}
                className={`image-tile ${tile.highlighted ? 'highlighted' : ''}`}
              >
                <img src={imageUrl} alt={`Tile ${tile.tileNumber}`} loading="lazy" />
                <span>{tile.highlighted ? '⬅ count these' : `Tile ${tile.tileNumber}`}</span>
              </div>
            )
          })}
        </div>

        <form className="challenge-form" onSubmit={onSubmit}>
          <label>
            Enter the number of balls shown in the highlighted image
            <input
              type="number"
              min="1"
              max="5"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </section>
    </div>
  )
}

function LoginScreen({
  mode,
  setMode,
  authForm,
  updateAuthField,
  handleAuthSubmit,
  busyState,
  feedback,
  showAuthModal,
  setShowAuthModal,
}) {

  const featuredEvents = [
    {
      id: 'featured-1',
      title: 'Freshers Opening Concert',
      detail: 'University Cultural Centre • 28 Aug 2026',
      badge: 'Featured',
      theme: 'theme-ocean',
      imageKey: 'FOC',
    },
    {
      id: 'featured-2',
      title: 'Campus Rhythm Night',
      detail: 'NUS Auditorium • 12 Sep 2026',
      badge: 'Selling Fast',
      theme: 'theme-sunset',
      imageKey: 'CRN',
    },
    {
      id: 'featured-3',
      title: 'Comedy & Chill Session',
      detail: 'Town Hall • 18 Sep 2026',
      badge: 'New',
      theme: 'theme-indigo',
      imageKey: 'CCS',
    },
  ]

  const smallerEvents = [
    {
      id: 'up-1',
      title: 'Indie Night Showcase',
      status: 'Upcoming',
      imageKey: 'indie_night',
      meta: 'Fri • 7:00 PM',
    },
    {
      id: 'up-2',
      title: 'Jazz in the Courtyard',
      status: 'Upcoming',
      imageKey: 'jazz_courtyard',
      meta: 'Sat • 8:30 PM',
    },
    {
      id: 'past-1',
      title: 'Spring Beats Festival',
      status: 'Past Event',
      imageKey: 'spring_beats_festival',
      meta: 'Completed • Jun 2026',
    },
    {
      id: 'past-2',
      title: 'Acoustic Sunset Live',
      status: 'Past Event',
      imageKey: 'acoustic_sunset',
      meta: 'Completed • May 2026',
    },
  ]

  return (
    <>
      <header className="site-header top-surface">
        <a href="#top" className="brand-lockup">
          <span className="brand-dot" />
          sgbooked
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#featured">Featured</a>
          <a href="#events">Events</a>
          <button type="button" className="nav-link-button" onClick={() => setShowAuthModal(true)}>
            Login
          </button>
        </nav>
        <div className="site-cta-group">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setMode('register')
              setShowAuthModal(true)
            }}
          >
            Sign Up
          </button>
          <button type="button" className="primary-link" onClick={() => setShowAuthModal(true)}>
            Login
          </button>
        </div>
      </header>

      <nav className="category-strip" aria-label="Browse categories">
        <a href="#" className="cat-pill active">All Events</a>
        <a href="#" className="cat-pill">Concerts</a>
        <a href="#" className="cat-pill">Sports</a>
        <a href="#" className="cat-pill">Arts &amp; Theatre</a>
        <a href="#" className="cat-pill">Family</a>
        <a href="#" className="cat-pill">Comedy</a>
        <a href="#" className="cat-pill">Festivals</a>
        <a href="#" className="cat-pill">Campus</a>
      </nav>

      <main id="top" className="site-home">
        <section className="hero-band">
          <div>
            <span className="eyebrow">Singapore Event Ticketing</span>
            <h1>Discover live events and secure seats in minutes.</h1>
            <p>
              Browse headline shows, upcoming campus experiences, and recent highlights with a
              modern, secure checkout flow.
            </p>
            <div className="hero-actions">
              <a href="#featured" className="primary-link">
                Explore Events
              </a>
              <button type="button" className="secondary-link" onClick={() => setShowAuthModal(true)}>
                Sign In to Book
              </button>
            </div>
          </div>
          <div className="hero-stats-grid" aria-hidden="true">
            <article>
              <strong>80+</strong>
              <span>Events Monthly</span>
            </article>
            <article>
              <strong>10K+</strong>
              <span>Tickets Sold</span>
            </article>
            <article>
              <strong>99.9%</strong>
              <span>Checkout Reliability</span>
            </article>
          </div>
        </section>

        <section id="featured" className="feature-section">
          <div className="section-heading" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
            <div>
              <h2>Featured Events</h2>
              <p>Big moments this month curated for students and young audiences.</p>
            </div>
            <a href="#" className="view-all">View all &rsaquo;</a>
          </div>
          <div className="featured-carousel" aria-label="Featured events carousel">
            <div className="featured-track">
              {[...featuredEvents, ...featuredEvents].map((item, index) => (
                <article
                  key={`${item.id}-${index}`}
                  className={`featured-card ${item.theme}`}
                  style={{
                    backgroundImage: `url(${API_ROOT}/api/admin/event-images/${item.imageKey})`,
                    backgroundSize: '100% 100%',
                  }}
                >
                  <span>{item.badge}</span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="events" className="mini-events-section">
          <div className="section-heading" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
            <div>
              <h2>Upcoming &amp; Past</h2>
              <p>Track what is next and revisit what just happened.</p>
            </div>
            <a href="#" className="view-all">View all &rsaquo;</a>
          </div>
          <div className="mini-events-grid">
            {smallerEvents.map((item) => (
              <article key={item.id} className="mini-event-card">
                <img
                  src={`${API_ROOT}/api/admin/event-images/${item.imageKey}`}
                  alt={item.title}
                  className="mini-event-image"
                  loading="lazy"
                />
                <div className="mini-event-content">
                  <span className={`status-pill ${item.status === 'Upcoming' ? 'upcoming' : 'past'}`}>
                    {item.status}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.meta}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {showAuthModal && (
          <section className="auth-modal-overlay" aria-label="Account login and registration">
            <div className="auth-modal-card card-surface">
              <div className="panel-heading">
                <div>
                  <h2>{mode === 'login' ? 'Login' : 'Create Profile'}</h2>
                </div>
                <button type="button" className="icon-button" onClick={() => setShowAuthModal(false)}>
                  Close
                </button>
              </div>

              <div className="segmented-control" role="tablist" aria-label="Authentication mode">
                <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
                  Login
                </button>
                <button
                  type="button"
                  className={mode === 'register' ? 'active' : ''}
                  onClick={() => setMode('register')}
                >
                  Create Profile
                </button>
              </div>

              {feedback && feedback.type === 'error' && (
                <div className="auth-inline-error">{feedback.text}</div>
              )}
              <form className="auth-form" onSubmit={handleAuthSubmit} autoComplete="off">
                {mode === 'register' && (
                  <label>
                    Full name
                    <input
                      type="text"
                      value={authForm.fullName}
                      onChange={(event) => updateAuthField('fullName', event.target.value)}
                      placeholder="Alicia Tan"
                      required
                    />
                  </label>
                )}
                <label>
                  Email address or username
                  <input
                    type="text"
                    value={authForm.email}
                    onChange={(event) => updateAuthField('email', event.target.value)}
                    placeholder="you@example.com or ADMIN"
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(event) => updateAuthField('password', event.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <button type="submit" className="primary-button" disabled={busyState === 'auth'}>
                  {busyState === 'auth' ? 'Submitting...' : mode === 'login' ? 'Login' : 'Create Profile'}
                </button>
              </form>
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-grid">
          <section>
            <h3>Categories</h3>
            <ul>
              <li><a href="#">Concerts</a></li>
              <li><a href="#">Sports</a></li>
              <li><a href="#">Arts, Theatre &amp; Comedy</a></li>
              <li><a href="#">Family Entertainment</a></li>
            </ul>
          </section>

          <section>
            <h3>Customer Care</h3>
            <ul>
              <li><a href="#">Help Center</a></li>
              <li><a href="#">Contact Us</a></li>
              <li><a href="#">News</a></li>
            </ul>
          </section>

          
          <section>
            <h3>Team</h3>
            <ul>
              <li><a href="#">Who We Are</a></li>
            </ul>
          </section>
        </div>
        <div className="footer-bottom">
          <span>&copy; 2026 sgbooked. All rights reserved.</span>
          <span>Powered by sgbooked platform &bull; Singapore</span>
        </div>
      </footer>
    </>
  )
}

function App() {
  const [mode, setMode] = useState('login')
  const [authForm, setAuthForm] = useState({
    fullName: '',
    email: '',
    password: '',
  })
  const [session, setSession] = useState(getStoredSession)
  const [pendingAuth, setPendingAuth] = useState(null)
  const [challengeAnswer, setChallengeAnswer] = useState('')
  const [layout, setLayout] = useState(null)
  const [selectedZoneId, setSelectedZoneId] = useState('FESTIVAL')
  const [selectedSeatIds, setSelectedSeatIds] = useState([])
  const [reservation, setReservation] = useState(null)
  const [countdown, setCountdown] = useState(0)
  const [expandedCartGroups, setExpandedCartGroups] = useState({})
  const [extensionChallenge, setExtensionChallenge] = useState(null)
  const [extensionAnswer, setExtensionAnswer] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [paymentForm, setPaymentForm] = useState(defaultPayment)
  const [feedback, setFeedback] = useState(null)
  const [busyState, setBusyState] = useState('')

  const [adminMenu, setAdminMenu] = useState('dashboard')
  const [passwordForm, setPasswordForm] = useState(defaultPasswordForm)
  const [events, setEvents] = useState(initialEvents)
  const [selectedEventId, setSelectedEventId] = useState(initialEvents[0].id)
  const [adminDashboardEventId, setAdminDashboardEventId] = useState(null)
  const [adminEditingEventId, setAdminEditingEventId] = useState(null)
  const [eventDraft, setEventDraft] = useState(null)
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    if (session) {
      window.localStorage.setItem('sgbooked-session', JSON.stringify(session))
      return
    }

    window.localStorage.removeItem('sgbooked-session')
  }, [session])

  const refreshLayout = useCallback(async () => {
    if (!session?.token) {
      setLayout(null)
      return
    }

    try {
      const nextLayout = await apiRequest('/booking/layout', {}, session.token)
      setLayout(nextLayout)
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    }
  }, [session?.token])

  useEffect(() => {
    refreshLayout()
  }, [session?.token, refreshLayout])

  useEffect(() => {
    if (!layout?.zones?.length) {
      return
    }

    const zoneStillExists = layout.zones.some((zone) => zone.zoneId === selectedZoneId)

    if (!zoneStillExists) {
      setSelectedZoneId(layout.zones[0].zoneId)
    }
  }, [layout, selectedZoneId])

  useEffect(() => {
    if (!adminEditingEventId) {
      setEventDraft(null)
      return
    }

    const active = events.find((item) => item.id === adminEditingEventId)
    if (active) {
      setEventDraft(active)
      return
    }

    setAdminEditingEventId(null)
    setEventDraft(null)
  }, [adminEditingEventId, events])

  const syncCountdown = useCallback(() => {
    if (!reservation?.expiresAt || reservation.status !== 'HELD') {
      setCountdown(0)
      return
    }

    const secondsLeft = Math.max(0, Math.floor((new Date(reservation.expiresAt).getTime() - Date.now()) / 1000))

    setCountdown(secondsLeft)

    if (secondsLeft === 0) {
      setFeedback({
        type: 'warning',
        text: 'Your seat hold has expired. Please start a new selection.',
      })
      setReservation(null)
      setSelectedSeatIds([])
      setExtensionChallenge(null)
      refreshLayout()
    }
  }, [refreshLayout, reservation?.expiresAt, reservation?.status])

  useEffect(() => {
    syncCountdown()

    if (!reservation?.expiresAt || reservation.status !== 'HELD') {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      syncCountdown()
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [reservation?.expiresAt, reservation?.status, syncCountdown])

  const flattenedSeats =
    layout?.zones.flatMap((zone) =>
      zone.seats.map((seat) => ({
        ...seat,
        zoneId: zone.zoneId,
        zoneLabel: zone.label,
        zoneColor: zone.color,
        zoneType: zone.type,
      })),
    ) ?? []

  const selectedZone = layout?.zones.find((zone) => zone.zoneId === selectedZoneId) ?? null
  const selectedSeats = flattenedSeats.filter((seat) => selectedSeatIds.includes(seat.seatId))
  const selectedCartItems = summarizeCartItems(selectedSeats)
  const selectedTotal = selectedSeats.reduce((total, seat) => total + seat.price, 0)
  const heldItems = summarizeCartItems(reservation?.items ?? [])
  const receiptItems = summarizeCartItems(receipt?.items ?? [])
  const isAdmin = session?.user?.role === 'ADMIN'
  const canSelectSeats = Boolean(session?.token) && layout?.released && !reservation
  const nearingExpiry = countdown > 0 && countdown <= 120
  const festivalSelectedCount = selectedSeats.filter((seat) => seat.zoneId === 'FESTIVAL').length

  const dashboardStats = useMemo(() => {
    if (!layout?.zones?.length) {
      return []
    }

    return layout.zones.map((zone) => {
      const stats = getZoneAvailability(zone)
      return {
        zoneId: zone.zoneId,
        label: zone.label,
        available: stats.availableCount,
        held: stats.heldCount,
        sold: stats.soldCount,
        total: stats.totalCount,
      }
    })
  }, [layout])

  function updateAuthField(field, value) {
    setAuthForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updatePaymentField(field, value) {
    setPaymentForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updatePasswordField(field, value) {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateEventDraft(field, value) {
    setEventDraft((current) => ({
      ...(current ?? initialEvents[0]),
      [field]: value,
    }))
  }

  function updateEventPrice(field, value) {
    setEventDraft((current) => ({
      ...(current ?? initialEvents[0]),
      pricing: {
        ...(current?.pricing ?? initialEvents[0].pricing),
        [field]: Number(value) || 0,
      },
    }))
  }

  function updateEventSeats(field, value) {
    setEventDraft((current) => ({
      ...(current ?? initialEvents[0]),
      seats: {
        ...(current?.seats ?? initialEvents[0].seats),
        [field]: Number(value) || 0,
      },
    }))
  }

  function toggleEventGroup(field) {
    setEventDraft((current) => ({
      ...(current ?? initialEvents[0]),
      openGroups: {
        ...(current?.openGroups ?? initialEvents[0].openGroups),
        [field]: !(current?.openGroups ?? initialEvents[0].openGroups)[field],
      },
    }))
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setBusyState('auth')

    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login' ? { email: authForm.email, password: authForm.password } : authForm

      const response = await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (mode === 'register') {
        setMode('login')
        setFeedback({
          type: 'success',
          text: 'Profile created. Please login with your credentials.',
        })
        return
      }

      setPendingAuth(response)
      setChallengeAnswer('')
      setFeedback(null)
      setShowLoginModal(false)
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setBusyState('')
    }
  }

  async function handleChallengeSubmit(event) {
    event.preventDefault()
    setBusyState('verify-auth')

    try {
      const ballCount = Number(challengeAnswer)
      if (!ballCount || ballCount < 1 || ballCount > 5) {
        throw new Error('Enter the number of balls (1–5) shown in the highlighted image.')
      }

      const response = await apiRequest('/auth/verify-human', {
        method: 'POST',
        body: JSON.stringify({
          pendingToken: pendingAuth.pendingToken,
          challengeId: pendingAuth.challenge.challengeId,
          answer: ballCount,
        }),
      })

      setSession({ token: response.token, user: response.user })
      setPendingAuth(null)
      setReservation(null)
      setReceipt(null)
      setSelectedSeatIds([])
      setAdminMenu('dashboard')
      setFeedback(null)
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setBusyState('')
    }
  }

  async function handleReleaseToggle() {
    setBusyState('release')

    try {
      const response = await apiRequest(
        '/admin/release',
        {
          method: 'POST',
          body: JSON.stringify({ released: !layout?.released }),
        },
        session.token,
      )

      setFeedback({
        type: 'success',
        text: response.message,
      })
      await refreshLayout()
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setBusyState('')
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setBusyState('password')

    try {
      const response = await apiRequest(
        '/auth/change-password',
        {
          method: 'POST',
          body: JSON.stringify(passwordForm),
        },
        session.token,
      )
      setPasswordForm(defaultPasswordForm)
      setFeedback({ type: 'success', text: response.message })
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setBusyState('')
    }
  }

  function saveEventChanges() {
    if (!eventDraft) {
      return
    }

    setEvents((current) => current.map((item) => (item.id === eventDraft.id ? eventDraft : item)))
    setFeedback({ type: 'success', text: 'Event settings saved in this session.' })
  }

  function createEvent() {
    const id = `event-${Date.now()}`
    const template = eventDraft ?? events[0] ?? initialEvents[0]
    const newEvent = {
      ...template,
      id,
      title: `New Event ${events.length + 1}`,
      pricing: { ...template.pricing },
      openGroups: { ...template.openGroups },
      seats: { ...template.seats },
    }
    setEvents((current) => [newEvent, ...current])
    setAdminEditingEventId(id)
    setSelectedEventId(id)
    setFeedback({ type: 'success', text: 'New event created in this session.' })
  }

  function deleteEvent(eventId) {
    const nextEvents = events.filter((item) => item.id !== eventId)

    setEvents(nextEvents)

    if (selectedEventId === eventId) {
      setSelectedEventId(nextEvents[0]?.id ?? '')
    }

    if (adminDashboardEventId === eventId) {
      setAdminDashboardEventId(null)
    }

    setAdminEditingEventId(null)
    setEventDraft(null)
    setFeedback({ type: 'success', text: 'Event deleted in this session.' })
  }

  function toggleSeat(seatId) {
    setSelectedSeatIds((current) =>
      current.includes(seatId) ? current.filter((entry) => entry !== seatId) : [...current, seatId],
    )
  }

  function toggleCartGroup(groupKey) {
    setExpandedCartGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }))
  }

  function clearSelection() {
    setSelectedSeatIds([])
    setExpandedCartGroups({})
  }

  function adjustFestivalQuantity(delta) {
    updateFestivalQuantity(String(festivalSelectedCount + delta))
  }

  function updateFestivalQuantity(quantityValue) {
    const quantity = Number(quantityValue)

    if (!selectedZone || selectedZone.zoneId !== 'FESTIVAL') {
      return
    }

    const safeQuantity = Number.isNaN(quantity) ? 0 : Math.max(0, quantity)
    const availableFestivalIds = selectedZone.seats
      .filter((seat) => seat.status === 'AVAILABLE')
      .map((seat) => seat.seatId)
      .slice(0, safeQuantity)

    setSelectedSeatIds((current) => [
      ...current.filter((seatId) => !seatId.startsWith('FESTIVAL-')),
      ...availableFestivalIds,
    ])
  }

  async function handleReserveSeats() {
    if (!selectedSeatIds.length) {
      setFeedback({ type: 'warning', text: 'Select an area, then choose seats or Festival quantity first.' })
      return
    }

    setBusyState('reserve')

    try {
      const response = await apiRequest(
        '/booking/reservations',
        {
          method: 'POST',
          body: JSON.stringify({ seatIds: selectedSeatIds }),
        },
        session.token,
      )

      setReservation(response)
      setSelectedSeatIds([])
      setExpandedCartGroups({})
      setReceipt(null)
      setFeedback({
        type: 'success',
        text: 'Seats are held for 10 minutes. Complete payment before the timer ends.',
      })
      await refreshLayout()
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setBusyState('')
    }
  }

  async function handleRequestExtension() {
    setBusyState('extension-request')

    try {
      const response = await apiRequest(
        `/booking/reservations/${reservation.reservationId}/extension-challenge`,
        {
          method: 'POST',
        },
        session.token,
      )

      setExtensionChallenge(response)
      setExtensionAnswer('')
      setFeedback({
        type: 'info',
        text: 'Complete the challenge to extend your hold by another 10 minutes.',
      })
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setBusyState('')
    }
  }

  async function handleExtensionSubmit(event) {
    event.preventDefault()
    setBusyState('extend')

    try {
      const response = await apiRequest(
        `/booking/reservations/${reservation.reservationId}/extend`,
        {
          method: 'POST',
          body: JSON.stringify({
            challengeId: extensionChallenge.challengeId,
            answer: Number(extensionAnswer),
          }),
        },
        session.token,
      )

      setReservation(response)
      setExtensionChallenge(null)
      setFeedback({
        type: 'success',
        text: 'Reservation hold extended for another 10 minutes.',
      })
      await refreshLayout()
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setBusyState('')
    }
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault()
    setBusyState('payment')

    try {
      const response = await apiRequest(
        `/booking/reservations/${reservation.reservationId}/payment`,
        {
          method: 'POST',
          body: JSON.stringify(paymentForm),
        },
        session.token,
      )

      setReceipt(response)
      setReservation(null)
      setExtensionChallenge(null)
      setPaymentForm(defaultPayment)
      setFeedback({
        type: 'success',
        text: response.message,
      })
      await refreshLayout()
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setBusyState('')
    }
  }

  function handleLogout() {
    setSession(null)
    setPendingAuth(null)
    setLayout(null)
    setSelectedZoneId('FESTIVAL')
    setReservation(null)
    setSelectedSeatIds([])
    setReceipt(null)
    setExtensionChallenge(null)
    setFeedback(null)
  }

  const selectedDashboardEvent = events.find((item) => item.id === adminDashboardEventId) ?? null

  if (!session) {
    return (
      <div className="app-shell">
        <LoginScreen
          mode={mode}
          setMode={setMode}
          authForm={authForm}
          updateAuthField={updateAuthField}
          handleAuthSubmit={handleAuthSubmit}
          busyState={busyState}
          feedback={feedback}
          showAuthModal={showLoginModal}
          setShowAuthModal={setShowLoginModal}
        />
        <VerificationModal
          title="Complete verification"
          description="Your username and password are correct. Please complete this challenge to finish login."
          challenge={pendingAuth?.challenge}
          answer={challengeAnswer}
          setAnswer={setChallengeAnswer}
          onSubmit={handleChallengeSubmit}
          busy={busyState === 'verify-auth'}
          onClose={() => setPendingAuth(null)}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="top-bar card-surface">
        <div className="top-brand">
          <span className="brand-dot" />
          <span>sgbooked</span>
        </div>
        <div className="top-bar-title">
          <h2>{isAdmin ? 'Admin Control Center' : 'Event Booking'}</h2>
          <p className="muted">{session.user.fullName} • {session.user.role}</p>
        </div>
        <button type="button" className="primary-button signout-button" onClick={handleLogout}>
          Sign Out
        </button>
      </header>

      {isAdmin ? (
        <main className="admin-layout">
          <nav className="admin-tabs" aria-label="Admin sections">
            <button
              type="button"
              className={`admin-tab ${adminMenu === 'dashboard' ? 'active' : ''}`}
              onClick={() => setAdminMenu('dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`admin-tab ${adminMenu === 'settings' ? 'active' : ''}`}
              onClick={() => setAdminMenu('settings')}
            >
              Settings
            </button>
            <button
              type="button"
              className={`admin-tab ${adminMenu === 'events' ? 'active' : ''}`}
              onClick={() => setAdminMenu('events')}
            >
              Manage Events
            </button>
          </nav>

          <section className="content-grid">
            {adminMenu === 'dashboard' && (
              <section className="card-surface panel">
                <div className="panel-heading compact-heading">
                  <div>
                    <span className="eyebrow">Dashboard</span>
                    <h3 style={{ color: 'var(--muted)' }}>Select an Event</h3>
                  </div>
                </div>

                <div className="admin-event-grid">
                  {events.map((eventItem) => (
                    <button
                      key={eventItem.id}
                      type="button"
                      className={`admin-event-card ${adminDashboardEventId === eventItem.id ? 'active' : ''}`}
                      onClick={() => setAdminDashboardEventId(eventItem.id)}
                    >
                      <span className="event-card-label">Event Name</span>
                      <h4>{eventItem.title}</h4>
                      <p>{eventItem.venue}</p>
                      <span className="event-date-block">
                        <span>Date / Time</span>
                        <strong>{eventItem.dateLabel}</strong>
                      </span>
                    </button>
                  ))}
                </div>

                {selectedDashboardEvent ? (
                  <div className="admin-detail-panel">
                    <div className="panel-heading compact-heading">
                      <div>
                        <span className="eyebrow">Event Details</span>
                        <h3>{selectedDashboardEvent.title}</h3>
                        <p className="muted">{selectedDashboardEvent.dateLabel}</p>
                      </div>
                      {layout && (
                        <span className={`release-indicator ${layout.released ? 'open' : 'closed'}`}>
                          {layout.released ? 'Sales Open' : 'Sales Closed'}
                        </span>
                      )}
                    </div>

                    <div className="stats-grid">
                  {dashboardStats.map((item) => (
                    <article key={item.zoneId} className="stat-card">
                      <h4>{item.label}</h4>
                      <p>
                        <strong>{item.available}</strong> available / {item.total}
                      </p>
                      <small>Held: {item.held} • Sold: {item.sold}</small>
                    </article>
                  ))}
                    </div>
                  </div>
                ) : (
                  <p className="admin-empty-state">Select an event card to view availability details.</p>
                )}
              </section>
            )}

            {adminMenu === 'settings' && (
              <section className="card-surface panel">
                <div className="panel-heading compact-heading">
                  <div>
                    <span className="eyebrow">Settings</span>
                    <h3>Change Password</h3>
                  </div>
                </div>
                <form className="auth-form" style={{maxWidth: '300px'}} onSubmit={handlePasswordSubmit}>
                  <label>
                    Current password
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) => updatePasswordField('currentPassword', event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    New password
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) => updatePasswordField('newPassword', event.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" className="primary-button" disabled={busyState === 'password'}>
                    {busyState === 'password' ? 'Updating...' : 'Change Password'}
                  </button>
                </form>
              </section>
            )}

            {adminMenu === 'events' && (
              <section className="card-surface panel">
                <div className="panel-heading compact-heading">
                  <div>
                    <span className="eyebrow">Manage Events</span>
                    <h3>Create and Configure Events</h3>
                  </div>
                  <button type="button" className="primary-button" onClick={createEvent}>
                    Create New Event
                  </button>
                </div>

                <div className="admin-event-grid">
                  {events.map((eventItem) => (
                    <button
                      key={eventItem.id}
                      type="button"
                      className={`admin-event-card ${adminEditingEventId === eventItem.id ? 'active' : ''}`}
                      onClick={() => setAdminEditingEventId(eventItem.id)}
                    >
                      <span className="event-card-label">Event Name</span>
                      <h4>{eventItem.title}</h4>
                      <p>{eventItem.venue}</p>
                      <span className="event-date-block">
                        <span>Date / Time</span>
                        <strong>{eventItem.dateLabel}</strong>
                      </span>
                    </button>
                  ))}
                </div>

                {eventDraft ? (
                  <div className="admin-detail-panel event-editor-panel">
                    <div className="panel-heading compact-heading">
                      <div>
                        <span className="eyebrow">Edit Event</span>
                        <h3>{eventDraft.title}</h3>
                      </div>
                    </div>

                <div className="editor-grid">
                  <label>
                    Event title
                    <input
                      value={eventDraft.title}
                      onChange={(event) => updateEventDraft('title', event.target.value)}
                    />
                  </label>
                  <label>
                    Venue
                    <input
                      value={eventDraft.venue}
                      onChange={(event) => updateEventDraft('venue', event.target.value)}
                    />
                  </label>
                  <label>
                    Date label
                    <input
                      value={eventDraft.dateLabel}
                      onChange={(event) => updateEventDraft('dateLabel', event.target.value)}
                    />
                  </label>
                  <label>
                    Release start
                    <input
                      type="datetime-local"
                      value={eventDraft.releaseStart}
                      onChange={(event) => updateEventDraft('releaseStart', event.target.value)}
                    />
                  </label>
                </div>

                <div className="pricing-grid">
                  <label>
                    Festival price
                    <input
                      type="number"
                      value={eventDraft.pricing.festival}
                      onChange={(event) => updateEventPrice('festival', event.target.value)}
                    />
                  </label>
                  <label>
                    VIP price
                    <input
                      type="number"
                      value={eventDraft.pricing.vip}
                      onChange={(event) => updateEventPrice('vip', event.target.value)}
                    />
                  </label>
                  <label>
                    Group 1 price
                    <input
                      type="number"
                      value={eventDraft.pricing.group1}
                      onChange={(event) => updateEventPrice('group1', event.target.value)}
                    />
                  </label>
                  <label>
                    Group 2 price
                    <input
                      type="number"
                      value={eventDraft.pricing.group2}
                      onChange={(event) => updateEventPrice('group2', event.target.value)}
                    />
                  </label>
                </div>

                <div className="pricing-grid">
                  <label>
                    Festival seats
                    <input
                      type="number"
                      value={eventDraft.seats.festival}
                      onChange={(event) => updateEventSeats('festival', event.target.value)}
                    />
                  </label>
                  <label>
                    VIP seats
                    <input
                      type="number"
                      value={eventDraft.seats.vip}
                      onChange={(event) => updateEventSeats('vip', event.target.value)}
                    />
                  </label>
                  <label>
                    Group 1 seats
                    <input
                      type="number"
                      value={eventDraft.seats.group1}
                      onChange={(event) => updateEventSeats('group1', event.target.value)}
                    />
                  </label>
                  <label>
                    Group 2 Left seats
                    <input
                      type="number"
                      value={eventDraft.seats.group2Left}
                      onChange={(event) => updateEventSeats('group2Left', event.target.value)}
                    />
                  </label>
                  <label>
                    Group 2 Right seats
                    <input
                      type="number"
                      value={eventDraft.seats.group2Right}
                      onChange={(event) => updateEventSeats('group2Right', event.target.value)}
                    />
                  </label>
                </div>

                <div className="toggle-row">
                  {Object.entries(eventDraft.openGroups).map(([key, value]) => (
                    <button key={key} type="button" className={`tag-toggle ${value ? 'on' : ''}`} onClick={() => toggleEventGroup(key)}>
                      {key} {value ? 'OPEN' : 'CLOSED'}
                    </button>
                  ))}
                </div>

                <div className="button-row">
                  <button type="button" className="primary-button" onClick={saveEventChanges}>
                    Save Changes
                  </button>
                  <button type="button" className="secondary-button danger-button" onClick={() => deleteEvent(eventDraft.id)}>
                    Delete Event
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleReleaseToggle}
                    disabled={busyState === 'release'}
                  >
                    {busyState === 'release'
                      ? 'Updating...'
                      : layout?.released
                        ? 'Pause Ticket Sales'
                        : 'Release Ticket Sales'}
                  </button>
                </div>
                  </div>
                ) : (
                  <p className="admin-empty-state">Select an event card to edit details, or create a new event.</p>
                )}
                <p className="muted copy-block">Event management is currently frontend session storage while backend APIs are being expanded.</p>
              </section>
            )}
          </section>
        </main>
      ) : (
        <main className="user-layout">
          <section className="event-selector-panel">
            <div className="panel-heading compact-heading">
              <div>
                <span className="eyebrow">Events</span>
                <h3>Choose your event</h3>
              </div>
            </div>
            <div className="event-cards">
              {events.map((eventItem) => (
                <button
                  key={eventItem.id}
                  type="button"
                  className={`event-card ${selectedEventId === eventItem.id ? 'active' : ''}`}
                  onClick={() => setSelectedEventId(eventItem.id)}
                >
                  <h4>{eventItem.title}</h4>
                  <p>{eventItem.venue}</p>
                  <small>{eventItem.dateLabel}</small>
                </button>
              ))}
            </div>
            
          </section>

          <div className="main-grid">
            <section className="left-column">
              {layout && (
                <section className="panel card-surface venue-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">Venue</span>
                      <h2>Seat Map Layout</h2>
                    </div>
                    <div className="legend-row">
                      {layout.zones.map((zone) => (
                        <span key={zone.zoneId} className="legend-pill">
                          <span className="legend-dot" style={{ backgroundColor: zone.color }} />
                          {zone.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="seat-map-shell">
                    <div className="seat-map-frame">
                      <div className="venue-stage seat-map-stage">STAGE</div>
                      <div className="seat-map-board">
                        {layout.zones.map((zone) => {
                          const stats = getZoneAvailability(zone)
                          const selected = zone.zoneId === selectedZoneId

                          return (
                            <button
                              key={zone.zoneId}
                              type="button"
                              className={`area-card ${getZoneMapClass(zone.zoneId)} ${selected ? 'selected' : ''}`}
                              style={{ '--zone-color': zone.color }}
                              onClick={() => setSelectedZoneId(zone.zoneId)}
                            >
                              <span className="area-title">{zone.label}</span>
                              <span className="area-detail">{zone.description}</span>
                              <span className="area-metrics">
                                <strong>{stats.availableCount}</strong>
                                <small>{zone.type === 'STANDING' ? 'passes left' : 'seats left'}</small>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {selectedZone && (
                    <article className="zone-card focused-zone-card">
                      <div className="zone-header">
                        <div>
                          <h3>{selectedZone.label}</h3>
                          <p>{selectedZone.description}</p>
                        </div>
                        <span className="zone-count">
                          {getZoneAvailability(selectedZone).availableCount} / {selectedZone.seats.length} available
                        </span>
                      </div>

                      {selectedZone.type === 'STANDING' ? (
                        <div className="festival-selector">
                          <div className="festival-copy">
                            <h4>Festival Passes</h4>
                            <p>Choose how many standing passes you want to hold. No seat picking is required.</p>
                          </div>
                          <div className="festival-controls">
                            <label>
                              Quantity
                              <div className="quantity-stepper">
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() => adjustFestivalQuantity(-1)}
                                  disabled={!canSelectSeats || festivalSelectedCount <= 0}
                                  aria-label="Decrease Festival quantity"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max={getZoneAvailability(selectedZone).availableCount}
                                  value={festivalSelectedCount}
                                  onChange={(event) => updateFestivalQuantity(event.target.value)}
                                  disabled={!canSelectSeats}
                                />
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() => adjustFestivalQuantity(1)}
                                  disabled={!canSelectSeats || festivalSelectedCount >= getZoneAvailability(selectedZone).availableCount}
                                  aria-label="Increase Festival quantity"
                                >
                                  +
                                </button>
                              </div>
                            </label>
                            <div className="festival-summary">
                              <span>Remaining availability</span>
                              <strong>{getZoneAvailability(selectedZone).availableCount}</strong>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="seat-grid">
                          {selectedZone.seats.map((seat) => {
                            const selected = selectedSeatIds.includes(seat.seatId)
                            const disabled = !canSelectSeats || (!selected && seat.status !== 'AVAILABLE')

                            return (
                              <button
                                key={seat.seatId}
                                type="button"
                                className={`seat-button ${seat.status.toLowerCase()} ${selected ? 'selected' : ''}`}
                                style={{ '--zone-color': selectedZone.color }}
                                onClick={() => toggleSeat(seat.seatId)}
                                disabled={disabled}
                              >
                                <span>{seat.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </article>
                  )}
                </section>
              )}
            </section>

            <aside className="right-column">
              <section className="panel card-surface cart-panel">
                <div className="panel-heading compact-heading">
                  <div>
                    <span className="eyebrow">Shopping Cart</span>
                    <h3>{reservation ? 'Held Order' : 'Selected Tickets'}</h3>
                  </div>
                  {reservation && <span className="countdown-badge">{formatCountdown(countdown)}</span>}
                </div>

                {reservation ? (
                  <>
                    <div className={`hold-banner ${nearingExpiry ? 'warning' : ''}`}>
                      <strong>{formatCountdown(countdown)}</strong>
                      <span>Remaining before release back to inventory.</span>
                    </div>
                    <div className="cart-groups">
                      {heldItems.map((item) => (
                        <article key={item.key} className="cart-group">
                          <button type="button" className="cart-group-main" onClick={() => toggleCartGroup(`held-${item.key}`)}>
                            <span>
                              <strong>{item.label}</strong>
                              <small>{item.detail}</small>
                            </span>
                            <strong>{formatCurrency(item.total)}</strong>
                          </button>
                          {expandedCartGroups[`held-${item.key}`] && (
                            <div className="cart-seat-list">{item.seats.join(', ')}</div>
                          )}
                        </article>
                      ))}
                    </div>
                    <div className="summary-row">
                      <span>Total</span>
                      <strong>{formatCurrency(reservation.total)}</strong>
                    </div>
                    {nearingExpiry && !extensionChallenge && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={handleRequestExtension}
                        disabled={busyState === 'extension-request'}
                      >
                        {busyState === 'extension-request' ? 'Preparing challenge...' : 'Extend Hold'}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="cart-panel-actions">
                      {selectedSeats.length > 0 && (
                        <button type="button" className="secondary-button compact-button" onClick={clearSelection}>
                          Clear Selection
                        </button>
                      )}
                    </div>
                    <div className="cart-groups">
                      {selectedCartItems.length ? (
                        selectedCartItems.map((item) => (
                          <article key={item.key} className="cart-group">
                            <button type="button" className="cart-group-main" onClick={() => toggleCartGroup(`selected-${item.key}`)}>
                              <span>
                                <strong>{item.label}</strong>
                                <small>{item.detail}</small>
                              </span>
                              <strong>{formatCurrency(item.total)}</strong>
                            </button>
                            {expandedCartGroups[`selected-${item.key}`] && (
                              <div className="cart-seat-list">{item.seats.join(', ')}</div>
                            )}
                          </article>
                        ))
                      ) : (
                        <p className="empty-state">No area selection added yet.</p>
                      )}
                    </div>
                    <div className="summary-row">
                      <span>Total</span>
                      <strong>{formatCurrency(selectedTotal)}</strong>
                    </div>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!selectedSeats.length || busyState === 'reserve' || !canSelectSeats}
                      onClick={handleReserveSeats}
                    >
                      {busyState === 'reserve' ? 'Holding seats...' : 'Checkout'}
                    </button>
                    {!layout?.released && (
                      <p className="muted copy-block">Waiting for admin to release the seating plan.</p>
                    )}
                  </>
                )}
              </section>

              {extensionChallenge && (
                <section className="panel card-surface">
                  <div className="panel-heading compact-heading">
                    <div>
                      <span className="eyebrow">Human Verification</span>
                      <h3>Extend Reservation</h3>
                    </div>
                  </div>
                  <p className="muted copy-block">Complete this challenge to add more checkout time.</p>
                  <p className="challenge-prompt">{extensionChallenge.prompt}</p>

                  <div className="image-grid compact">
                    {extensionChallenge.tiles.map((tile) => {
                      const selected = extensionAnswer === String(tile.tileNumber)
                      const imageUrl = `${API_ROOT}${tile.imageUrl}`
                      return (
                        <button
                          key={tile.tileNumber}
                          type="button"
                          className={`image-tile ${tile.highlighted ? 'highlighted' : ''} ${selected ? 'selected' : ''}`}
                          onClick={() => setExtensionAnswer(String(tile.tileNumber))}
                        >
                          <img src={imageUrl} alt={`Extension tile ${tile.tileNumber}`} loading="lazy" />
                          <span>Tile {tile.tileNumber}</span>
                        </button>
                      )
                    })}
                  </div>

                  <form className="challenge-form" onSubmit={handleExtensionSubmit}>
                    <label>
                      Number of balls in highlighted image
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={extensionAnswer}
                        onChange={(event) => setExtensionAnswer(event.target.value)}
                        required
                      />
                    </label>
                    <button type="submit" className="primary-button" disabled={busyState === 'extend'}>
                      {busyState === 'extend' ? 'Checking...' : 'Verify and Extend'}
                    </button>
                  </form>
                </section>
              )}

              {reservation && (
                <section className="panel card-surface payment-panel">
                  <div className="panel-heading compact-heading">
                    <div>
                      <span className="eyebrow">Payment</span>
                      <h3>Checkout</h3>
                    </div>
                  </div>
                  <form className="payment-form" onSubmit={handlePaymentSubmit}>
                    <label>
                      Payment method
                      <select value={paymentForm.method} onChange={(event) => updatePaymentField('method', event.target.value)}>
                        {Object.entries(paymentMethodLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {paymentForm.method === 'CARD' ? (
                      <>
                        <label>
                          Cardholder name
                          <input
                            type="text"
                            value={paymentForm.cardHolder}
                            onChange={(event) => updatePaymentField('cardHolder', event.target.value)}
                            required
                          />
                        </label>
                        <label>
                          Card number
                          <input
                            type="text"
                            value={paymentForm.cardNumber}
                            onChange={(event) => updatePaymentField('cardNumber', event.target.value)}
                            placeholder="4111 1111 1111 1111"
                            required
                          />
                        </label>
                        <div className="split-fields">
                          <label>
                            Expiry date
                            <input
                              type="text"
                              value={paymentForm.expiryDate}
                              onChange={(event) => updatePaymentField('expiryDate', event.target.value)}
                              placeholder="12/30"
                              required
                            />
                          </label>
                          <label>
                            CVV
                            <input
                              type="password"
                              value={paymentForm.cvv}
                              onChange={(event) => updatePaymentField('cvv', event.target.value)}
                              placeholder="123"
                              required
                            />
                          </label>
                        </div>
                      </>
                    ) : paymentForm.method === 'PAYNOW' ? (
                      <label>
                        PayNow mobile number
                        <input
                          type="text"
                          value={paymentForm.payNowNumber}
                          onChange={(event) => updatePaymentField('payNowNumber', event.target.value)}
                          placeholder="+65 9123 4567"
                          required
                        />
                      </label>
                    ) : (
                      <label>
                        Wallet identifier
                        <input
                          type="text"
                          value={paymentForm.walletId}
                          onChange={(event) => updatePaymentField('walletId', event.target.value)}
                          placeholder="Wallet email or account id"
                          required
                        />
                      </label>
                    )}

                    <button type="submit" className="primary-button" disabled={busyState === 'payment'}>
                      {busyState === 'payment' ? 'Processing...' : `Pay ${formatCurrency(reservation.total)}`}
                    </button>
                  </form>
                </section>
              )}

              {receipt && (
                <section className="panel card-surface receipt-panel">
                  <div className="panel-heading compact-heading">
                    <div>
                      <span className="eyebrow">Confirmation</span>
                      <h3>Order Completed</h3>
                    </div>
                  </div>
                  <p className="muted copy-block">Reference {receipt.reference}. Your booking is confirmed.</p>
                  <div className="cart-groups">
                    {receiptItems.map((item) => (
                      <article key={item.key} className="cart-group">
                        <button type="button" className="cart-group-main" onClick={() => toggleCartGroup(`receipt-${item.key}`)}>
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.detail}</small>
                          </span>
                          <strong>{formatCurrency(item.total)}</strong>
                        </button>
                        {expandedCartGroups[`receipt-${item.key}`] && (
                          <div className="cart-seat-list">{item.seats.join(', ')}</div>
                        )}
                      </article>
                    ))}
                  </div>
                  <div className="summary-row">
                    <span>Paid</span>
                    <strong>{formatCurrency(receipt.total)}</strong>
                  </div>
                </section>
              )}
            </aside>
          </div>
        </main>
      )}

      <VerificationModal
        title="Complete verification"
        description="Your username and password are correct. Please complete this challenge to finish login."
        challenge={pendingAuth?.challenge}
        answer={challengeAnswer}
        setAnswer={setChallengeAnswer}
        onSubmit={handleChallengeSubmit}
        busy={busyState === 'verify-auth'}
      />
    </div>
  )
}

export default App

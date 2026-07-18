import { useEffect, useEffectEvent, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

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
  const festivalItems = items.filter((item) => item.zoneId === 'FESTIVAL' || item.zoneLabel === 'Festival')
  const otherItems = items.filter((item) => item.zoneId !== 'FESTIVAL' && item.zoneLabel !== 'Festival')
  const entries = otherItems.map((item) => ({
    key: item.seatId,
    label: item.label,
    detail: item.zoneLabel,
    total: item.price,
  }))

  if (festivalItems.length) {
    entries.unshift({
      key: 'festival-bundle',
      label: `Festival x${festivalItems.length}`,
      detail: 'Standing passes',
      total: festivalItems.reduce((sum, item) => sum + item.price, 0),
    })
  }

  return entries
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
    throw new Error(payload?.message ?? 'Request failed.')
  }

  return payload
}

function BallTile({ tile, active, onClick }) {
  return (
    <button
      type="button"
      className={`ball-tile ${tile.highlighted ? 'highlighted' : ''} ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="ball-tile-label">Tile {tile.tileNumber}</span>
      <span className="ball-stack" aria-hidden="true">
        {Array.from({ length: tile.ballCount }).map((_, index) => (
          <span key={`${tile.tileNumber}-${index}`} className="ball-dot" />
        ))}
      </span>
    </button>
  )
}

function ChallengePanel({
  title,
  description,
  challenge,
  answer,
  setAnswer,
  onSubmit,
  busy,
}) {
  return (
    <section className="panel challenge-panel">
      <div className="panel-heading compact-heading">
        <div>
          <span className="eyebrow">Human Verification</span>
          <h3>{title}</h3>
        </div>
      </div>
      <p className="muted copy-block">{description}</p>
      <p className="challenge-prompt">{challenge.prompt}</p>
      <div className="ball-grid">
        {challenge.tiles.map((tile) => (
          <BallTile
            key={tile.tileNumber}
            tile={tile}
            active={answer === String(tile.ballCount) && tile.highlighted}
            onClick={() => {
              if (tile.highlighted) {
                setAnswer(String(tile.ballCount))
              }
            }}
          />
        ))}
      </div>
      <form className="challenge-form" onSubmit={onSubmit}>
        <label>
          Number of balls
          <input
            type="number"
            min="1"
            max="9"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            required
          />
        </label>
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? 'Checking...' : 'Verify'}
        </button>
      </form>
    </section>
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
  const [extensionChallenge, setExtensionChallenge] = useState(null)
  const [extensionAnswer, setExtensionAnswer] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [paymentForm, setPaymentForm] = useState(defaultPayment)
  const [feedback, setFeedback] = useState({ type: 'info', text: 'Create a profile or sign in to start booking.' })
  const [busyState, setBusyState] = useState('')

  useEffect(() => {
    if (session) {
      window.localStorage.setItem('sgbooked-session', JSON.stringify(session))
      return
    }

    window.localStorage.removeItem('sgbooked-session')
  }, [session])

  const refreshLayout = useEffectEvent(async () => {
    if (!session?.token) {
      setLayout(null)
      return
    }

    try {
      const nextLayout = await apiRequest('/booking/layout', {}, session.token)
      setLayout(nextLayout)
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.message,
      })
    }
  })

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

  const syncCountdown = useEffectEvent(() => {
    if (!reservation?.expiresAt || reservation.status !== 'HELD') {
      setCountdown(0)
      return
    }

    const secondsLeft = Math.max(
      0,
      Math.floor((new Date(reservation.expiresAt).getTime() - Date.now()) / 1000),
    )

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
  })

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

  const flattenedSeats = layout?.zones.flatMap((zone) =>
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

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setBusyState('auth')

    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const body =
        mode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : authForm

      const response = await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      setPendingAuth(response)
      setChallengeAnswer('')
      setFeedback({
        type: 'info',
        text: response.message,
      })
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
      const response = await apiRequest('/auth/verify-human', {
        method: 'POST',
        body: JSON.stringify({
          pendingToken: pendingAuth.pendingToken,
          challengeId: pendingAuth.challenge.challengeId,
          answer: Number(challengeAnswer),
        }),
      })

      setSession({ token: response.token, user: response.user })
      setPendingAuth(null)
      setReservation(null)
      setReceipt(null)
      setFeedback({ type: 'success', text: response.message })
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

  function toggleSeat(seatId) {
    setSelectedSeatIds((current) =>
      current.includes(seatId)
        ? current.filter((entry) => entry !== seatId)
        : [...current, seatId],
    )
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
    setFeedback({ type: 'info', text: 'You have signed out.' })
  }

  return (
    <div className="app-shell">
      <header className="hero-banner">
        <div className="hero-copy">
          <span className="eyebrow">NUS-Inspired Ticketing Experience</span>
          <h1>sgbooked</h1>
          <p>
            Event booking app for your entertainment.
          </p>
        </div>
 
          
      </header>

      <div className={`feedback-strip ${feedback.type}`}>{feedback.text}</div>

      <main className="main-grid">
        <section className="left-column">
          <section className="panel auth-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Access</span>
                <h2>{session ? 'Your Session' : 'Login or Create Profile'}</h2>
              </div>
              {!session && (
                <div className="segmented-control" role="tablist" aria-label="Authentication mode">
                  <button
                    type="button"
                    className={mode === 'login' ? 'active' : ''}
                    onClick={() => setMode('login')}
                  >
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
              )}
            </div>

            {session ? (
              <div className="session-card">
                <div>
                  <h3>{session.user.fullName}</h3>
                  <p>{session.user.email}</p>
                </div>
                <span className={`role-chip ${isAdmin ? 'admin' : 'user'}`}>{session.user.role}</span>
                <button type="button" className="secondary-button" onClick={handleLogout}>
                  Sign Out
                </button>
                {isAdmin && (
                  <p className="muted copy-block">
                    Admin controls can release the seating plan for customers.  
                  </p>
                )}
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleAuthSubmit}>
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
                    required
                  />
                </label>
                <button type="submit" className="primary-button" disabled={busyState === 'auth'}>
                  {busyState === 'auth'
                    ? 'Submitting...'
                    : mode === 'login'
                      ? 'Continue to Verification'
                      : 'Create Profile'}
                </button>
                <p className="muted copy-block">
                  Every successful login or registration triggers an email notification through the
                  backend SMTP settings.
                </p>
              </form>
            )}
          </section>

          {pendingAuth && (
            <ChallengePanel
              title="Confirm you are human"
              description="Pick out the highlighted tile, count the balls shown, and type the number to finish signing in."
              challenge={pendingAuth.challenge}
              answer={challengeAnswer}
              setAnswer={setChallengeAnswer}
              onSubmit={handleChallengeSubmit}
              busy={busyState === 'verify-auth'}
            />
          )}

          {isAdmin && layout && (
            <section className="panel admin-panel">
              <div className="panel-heading compact-heading">
                <div>
                  <span className="eyebrow">Admin Console</span>
                  <h3>Release Seats</h3>
                </div>
                <span className={`release-indicator ${layout.released ? 'open' : 'closed'}`}>
                  {layout.released ? 'Sales Open' : 'Sales Closed'}
                </span>
              </div>
              <p className="muted copy-block">
                Enable this switch when you want customers to start selecting VIP, Group, or
                Festival inventory.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={handleReleaseToggle}
                disabled={busyState === 'release'}
              >
                {busyState === 'release'
                  ? 'Updating...'
                  : layout.released
                    ? 'Pause Ticket Sales'
                    : 'Release Seats to Users'}
              </button>
            </section>
          )}

          {layout && (
            <section className="panel venue-panel">
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
                          <input
                            type="number"
                            min="0"
                            max={getZoneAvailability(selectedZone).availableCount}
                            value={festivalSelectedCount}
                            onChange={(event) => updateFestivalQuantity(event.target.value)}
                            disabled={!canSelectSeats}
                          />
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
                            <small>{formatCurrency(seat.price)}</small>
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
 

          <section className="panel cart-panel">
            <div className="panel-heading compact-heading">
              <div>
                <span className="eyebrow">Cart</span>
                <h3>{reservation ? 'Held Order' : 'Selected Tickets'}</h3>
              </div>
              {reservation && <span className="countdown-badge">{formatCountdown(countdown)}</span>}
            </div>

            {reservation ? (
              <>
                <div className={`hold-banner ${nearingExpiry ? 'warning' : ''}`}>
                  <strong>{formatCountdown(countdown)}</strong>
                  <span>
                    Remaining before release back to inventory.
                  </span>
                </div>
                <ul className="cart-list">
                  {heldItems.map((item) => (
                    <li key={item.key}>
                      <span>{item.label}</span>
                      <span>{item.detail}</span>
                      <strong>{formatCurrency(item.total)}</strong>
                    </li>
                  ))}
                </ul>
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
                    {busyState === 'extension-request'
                      ? 'Preparing challenge...'
                      : 'Extend Hold'}
                  </button>
                )}
              </>
            ) : (
              <>
                <ul className="cart-list">
                  {selectedCartItems.length ? (
                    selectedCartItems.map((item) => (
                      <li key={item.key}>
                        <span>{item.label}</span>
                        <span>{item.detail}</span>
                        <strong>{formatCurrency(item.total)}</strong>
                      </li>
                    ))
                  ) : (
                    <li className="empty-state">No area selection added yet.</li>
                  )}
                </ul>
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
                  {busyState === 'reserve' ? 'Holding seats...' : 'Hold Seats for 10 Minutes'}
                </button>
                {!layout?.released && !isAdmin && (
                  <p className="muted copy-block">Waiting for admin to release the seating plan.</p>
                )}
              </>
            )}
          </section>

          {extensionChallenge && (
            <ChallengePanel
              title="Extend reservation"
              description="To prevent bots from holding inventory, complete another challenge before your hold is refreshed."
              challenge={extensionChallenge}
              answer={extensionAnswer}
              setAnswer={setExtensionAnswer}
              onSubmit={handleExtensionSubmit}
              busy={busyState === 'extend'}
            />
          )}

          {reservation && (
            <section className="panel payment-panel">
              <div className="panel-heading compact-heading">
                <div>
                  <span className="eyebrow">Payment</span>
                  <h3>Sample Checkout</h3>
                </div>
              </div>
              <form className="payment-form" onSubmit={handlePaymentSubmit}>
                <label>
                  Payment method
                  <select
                    value={paymentForm.method}
                    onChange={(event) => updatePaymentField('method', event.target.value)}
                  >
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
            <section className="panel receipt-panel">
              <div className="panel-heading compact-heading">
                <div>
                  <span className="eyebrow">Confirmation</span>
                  <h3>Order Completed</h3>
                </div>
              </div>
              <p className="muted copy-block">
                Reference {receipt.reference}. Your confirmation message has been routed through the
                backend notification service.
              </p>
              <ul className="cart-list">
                {receiptItems.map((item) => (
                  <li key={item.key}>
                    <span>{item.label}</span>
                    <span>{item.detail}</span>
                    <strong>{formatCurrency(item.total)}</strong>
                  </li>
                ))}
              </ul>
              <div className="summary-row">
                <span>Paid</span>
                <strong>{formatCurrency(receipt.total)}</strong>
              </div>
            </section>
          )}
        </aside>
      </main>
    </div>
  )
}

export default App

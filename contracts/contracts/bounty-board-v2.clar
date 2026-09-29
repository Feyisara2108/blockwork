;; bounty-board.clar
;; Post a task with STX locked in escrow. A worker claims it, submits a link
;; to their work, and the poster approves to release payment. Open bounties
;; stop accepting claims at their deadline; the poster can then cancel for a refund.
;;
;; Two timeouts keep funds from getting stuck:
;;   - a claim that sees no submission within CLAIM_WINDOW can be reopened by the poster
;;   - a submission the poster ignores for REVIEW_WINDOW can be paid out by the worker
;; Windows are measured in Bitcoin blocks (burn-block-height, ~10 min each).

(define-constant CLAIM_WINDOW u144)   ;; ~1 day
(define-constant REVIEW_WINDOW u144)  ;; ~1 day
(define-constant MIN_REWARD u100000)  ;; 0.1 STX
(define-constant MIN_DURATION u6)     ;; ~1 hour
(define-constant MAX_DURATION u4320)  ;; ~30 days

(define-constant STATUS_OPEN u0)
(define-constant STATUS_CLAIMED u1)
(define-constant STATUS_SUBMITTED u2)
(define-constant STATUS_PAID u3)
(define-constant STATUS_CANCELLED u4)

(define-constant ERR_NOT_FOUND (err u100))
(define-constant ERR_NOT_POSTER (err u101))
(define-constant ERR_NOT_WORKER (err u102))
(define-constant ERR_WRONG_STATUS (err u103))
(define-constant ERR_OWN_BOUNTY (err u104))
(define-constant ERR_REWARD_TOO_LOW (err u105))
(define-constant ERR_EMPTY_TITLE (err u106))
(define-constant ERR_EMPTY_LINK (err u107))
(define-constant ERR_TOO_EARLY (err u108))
(define-constant ERR_EXPIRED (err u109))
(define-constant ERR_BAD_DURATION (err u110))

(define-data-var bounty-count uint u0)

(define-map bounties
  uint
  {
    poster: principal,
    title: (string-utf8 80),
    details: (string-utf8 500),
    category: (string-ascii 24),
    reward: uint,
    status: uint,
    worker: (optional principal),
    submission: (optional (string-ascii 200)),
    created-at: uint,
    deadline: uint,
    claimed-at: uint,
    submitted-at: uint,
  }
)

;; --- read-only ---

(define-read-only (get-bounty (id uint))
  (map-get? bounties id))

(define-read-only (get-bounty-count)
  (var-get bounty-count))

(define-read-only (get-windows)
  {
    claim-window: CLAIM_WINDOW,
    review-window: REVIEW_WINDOW,
    current-height: burn-block-height,
  })

;; --- private ---

(define-private (pay-out (amount uint) (recipient principal))
  (as-contract? ((with-stx amount))
    (try! (stx-transfer? amount tx-sender recipient))))

;; --- public ---

;; `duration` is how many Bitcoin blocks the bounty stays claimable.
(define-public (post-bounty
    (title (string-utf8 80))
    (details (string-utf8 500))
    (category (string-ascii 24))
    (reward uint)
    (duration uint)
  )
  (let ((id (+ (var-get bounty-count) u1)))
    (asserts! (> (len title) u0) ERR_EMPTY_TITLE)
    (asserts! (>= reward MIN_REWARD) ERR_REWARD_TOO_LOW)
    (asserts! (and (>= duration MIN_DURATION) (<= duration MAX_DURATION)) ERR_BAD_DURATION)
    (try! (stx-transfer? reward tx-sender current-contract))
    (map-set bounties id {
      poster: tx-sender,
      title: title,
      details: details,
      category: category,
      reward: reward,
      status: STATUS_OPEN,
      worker: none,
      submission: none,
      created-at: burn-block-height,
      deadline: (+ burn-block-height duration),
      claimed-at: u0,
      submitted-at: u0,
    })
    (var-set bounty-count id)
    (ok id)))

(define-public (cancel-bounty (id uint))
  (let ((bounty (unwrap! (map-get? bounties id) ERR_NOT_FOUND)))
    (asserts! (is-eq tx-sender (get poster bounty)) ERR_NOT_POSTER)
    (asserts! (is-eq (get status bounty) STATUS_OPEN) ERR_WRONG_STATUS)
    (try! (pay-out (get reward bounty) (get poster bounty)))
    (map-set bounties id (merge bounty { status: STATUS_CANCELLED }))
    (ok true)))

(define-public (claim-bounty (id uint))
  (let ((bounty (unwrap! (map-get? bounties id) ERR_NOT_FOUND)))
    (asserts! (is-eq (get status bounty) STATUS_OPEN) ERR_WRONG_STATUS)
    (asserts! (not (is-eq tx-sender (get poster bounty))) ERR_OWN_BOUNTY)
    (asserts! (< burn-block-height (get deadline bounty)) ERR_EXPIRED)
    (map-set bounties id (merge bounty {
      status: STATUS_CLAIMED,
      worker: (some tx-sender),
      claimed-at: burn-block-height,
    }))
    (ok true)))

(define-public (abandon-claim (id uint))
  (let ((bounty (unwrap! (map-get? bounties id) ERR_NOT_FOUND)))
    (asserts! (is-eq (get status bounty) STATUS_CLAIMED) ERR_WRONG_STATUS)
    (asserts! (is-eq (some tx-sender) (get worker bounty)) ERR_NOT_WORKER)
    (map-set bounties id (merge bounty { status: STATUS_OPEN, worker: none, claimed-at: u0 }))
    (ok true)))

(define-public (submit-work (id uint) (link (string-ascii 200)))
  (let ((bounty (unwrap! (map-get? bounties id) ERR_NOT_FOUND)))
    (asserts! (is-eq (get status bounty) STATUS_CLAIMED) ERR_WRONG_STATUS)
    (asserts! (is-eq (some tx-sender) (get worker bounty)) ERR_NOT_WORKER)
    (asserts! (> (len link) u0) ERR_EMPTY_LINK)
    (map-set bounties id (merge bounty {
      status: STATUS_SUBMITTED,
      submission: (some link),
      submitted-at: burn-block-height,
    }))
    (ok true)))

(define-public (approve-work (id uint))
  (let (
      (bounty (unwrap! (map-get? bounties id) ERR_NOT_FOUND))
      (worker (unwrap! (get worker bounty) ERR_WRONG_STATUS))
    )
    (asserts! (is-eq tx-sender (get poster bounty)) ERR_NOT_POSTER)
    (asserts! (is-eq (get status bounty) STATUS_SUBMITTED) ERR_WRONG_STATUS)
    (try! (pay-out (get reward bounty) worker))
    (map-set bounties id (merge bounty { status: STATUS_PAID }))
    (ok true)))

;; Poster takes the bounty back from a worker who claimed it and went quiet.
(define-public (reopen-bounty (id uint))
  (let ((bounty (unwrap! (map-get? bounties id) ERR_NOT_FOUND)))
    (asserts! (is-eq tx-sender (get poster bounty)) ERR_NOT_POSTER)
    (asserts! (is-eq (get status bounty) STATUS_CLAIMED) ERR_WRONG_STATUS)
    (asserts! (>= burn-block-height (+ (get claimed-at bounty) CLAIM_WINDOW)) ERR_TOO_EARLY)
    (map-set bounties id (merge bounty { status: STATUS_OPEN, worker: none, claimed-at: u0 }))
    (ok true)))

;; Worker collects payment when the poster never reviewed the submission.
(define-public (claim-payout (id uint))
  (let (
      (bounty (unwrap! (map-get? bounties id) ERR_NOT_FOUND))
      (worker (unwrap! (get worker bounty) ERR_WRONG_STATUS))
    )
    (asserts! (is-eq tx-sender worker) ERR_NOT_WORKER)
    (asserts! (is-eq (get status bounty) STATUS_SUBMITTED) ERR_WRONG_STATUS)
    (asserts! (>= burn-block-height (+ (get submitted-at bounty) REVIEW_WINDOW)) ERR_TOO_EARLY)
    (try! (pay-out (get reward bounty) worker))
    (map-set bounties id (merge bounty { status: STATUS_PAID }))
    (ok true)))

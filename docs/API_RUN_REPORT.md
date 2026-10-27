# API run report (2026-10-25T09:39:01.641Z)

Base URL: http://localhost:4000 · run id `mbls4`

- Operations in the spec: **106**
- Operations exercised: **106**
- Requests made: **224**, passed: **223**, failed: **1**

> **The 1 failure is a test-script artifact, not an API bug.** C's access token expired mid-run, so the
> script signed in again (a new session), but the logout sent the refresh token of C's original sign-up
> session. That revoked the old session, not the current one. Checked by hand afterwards: login → logout with
> the same session's refresh token (204) → `GET /auth/me` answers 401 `SESSION_REVOKED`.
>
> The **503** and **401** responses on Google/Apple sign-in and linking are expected: they aren't configured
> here and the run used fake tokens.

Test users (password `Testpass123`; A's is `Newpass456`): `swtest_a_mbls4` (+919811542556), `swtest_b_mbls4` (+919842299791), `swtest_c_mbls4` (+919895727891), `swtest_d_mbls4` (+919839238255)

Created ids: m1=`01a1725e-4bec-7154-ace9-321462c71f32` · tournament=`01a17263-d9e3-775e-9b79-92e1d808a594` · slug=`swagger-open-mbls4-7a8a84` · event=`01a17265-29eb-79c5-a2a4-eaa40fe9e3f0` · post=`12cc3645-7743-4d1a-a85e-c21ec46ba763` · direct=`999daa5b-e860-4954-b2ef-50516978fe2d` · group=`197101a7-ec06-4150-8b86-ef34d8b8b935`

## Failures
| Status | Expected | Request | Error | Note |
|---|---|---|---|---|
| 200 | 401 | `GET /api/v1/auth/me` |  | logged-out token is rejected |

## Not exercised
None: every operation in the spec was called.

## Per operation
| Operation | Calls | Statuses | Result |
|---|---|---|---|
| `GET /health` | 1 | 200 | ✅ |
| `POST /api/v1/auth/register/start` | 4 | 200 | ✅ |
| `POST /api/v1/auth/register/verify` | 4 | 200 | ✅ |
| `GET /api/v1/auth/username-available` | 4 | 200 | ✅ |
| `POST /api/v1/auth/register/complete` | 4 | 201 | ✅ |
| `POST /api/v1/auth/login` | 3 | 200, 401 | ✅ |
| `POST /api/v1/auth/phone/start` | 1 | 200 | ✅ |
| `POST /api/v1/auth/phone/verify` | 1 | 200 | ✅ |
| `POST /api/v1/auth/password/forgot` | 1 | 200 | ✅ |
| `POST /api/v1/auth/password/reset` | 1 | 200 | ✅ |
| `POST /api/v1/auth/google` | 1 | 503 | ✅ |
| `POST /api/v1/auth/apple` | 1 | 503 | ✅ |
| `POST /api/v1/auth/refresh` | 2 | 200, 401 | ✅ |
| `POST /api/v1/auth/logout` | 1 | 204 | ✅ |
| `GET /api/v1/auth/me` | 4 | 200, 401 | ❌ 1 failed |
| `GET /api/v1/auth/sessions` | 1 | 200 | ✅ |
| `POST /api/v1/auth/sessions/sign-out-others` | 1 | 200 | ✅ |
| `GET /api/v1/auth/identities` | 1 | 200 | ✅ |
| `POST /api/v1/auth/identities/google` | 1 | 503 | ✅ |
| `POST /api/v1/auth/identities/apple` | 1 | 503 | ✅ |
| `DELETE /api/v1/auth/identities/{provider}` | 1 | 200 | ✅ |
| `GET /api/v1/sports` | 1 | 200 | ✅ |
| `GET /api/v1/sports/{slug}` | 2 | 200, 404 | ✅ |
| `GET /api/v1/profile/me` | 1 | 200 | ✅ |
| `PATCH /api/v1/profile/me` | 1 | 200 | ✅ |
| `PUT /api/v1/profile/me/sports` | 3 | 200 | ✅ |
| `GET /api/v1/profile/me/matches` | 1 | 200 | ✅ |
| `GET /api/v1/players` | 1 | 200 | ✅ |
| `GET /api/v1/players/me` | 1 | 200 | ✅ |
| `GET /api/v1/players/guests` | 1 | 200 | ✅ |
| `POST /api/v1/players/guests` | 1 | 201 | ✅ |
| `GET /api/v1/players/claimable` | 1 | 200 | ✅ |
| `POST /api/v1/players/claim` | 1 | 200 | ✅ |
| `POST /api/v1/matches` | 7 | 201 | ✅ |
| `GET /api/v1/matches/live` | 1 | 200 | ✅ |
| `GET /api/v1/matches/pending-confirmations` | 1 | 200 | ✅ |
| `GET /api/v1/matches/{id}` | 5 | 200 | ✅ |
| `GET /api/v1/matches/{id}/details` | 1 | 200 | ✅ |
| `POST /api/v1/matches/{id}/events` | 48 | 200, 409, 403 | ✅ |
| `POST /api/v1/matches/{id}/undo` | 1 | 200 | ✅ |
| `POST /api/v1/matches/{id}/complete` | 3 | 409, 200 | ✅ |
| `POST /api/v1/matches/{id}/retire` | 1 | 200 | ✅ |
| `POST /api/v1/matches/{id}/walkover` | 1 | 200 | ✅ |
| `POST /api/v1/matches/{id}/abandon` | 1 | 200 | ✅ |
| `POST /api/v1/matches/{id}/confirm` | 3 | 403, 200 | ✅ |
| `POST /api/v1/matches/{id}/scorers` | 1 | 200 | ✅ |
| `GET /api/v1/tournaments` | 4 | 200 | ✅ |
| `POST /api/v1/tournaments` | 1 | 201 | ✅ |
| `GET /api/v1/tournaments/me/matches` | 1 | 200 | ✅ |
| `GET /api/v1/tournaments/{id}` | 2 | 200 | ✅ |
| `PATCH /api/v1/tournaments/{id}` | 2 | 200, 403 | ✅ |
| `GET /api/v1/tournaments/{id}/fixtures` | 1 | 200 | ✅ |
| `POST /api/v1/tournaments/{id}/staff` | 2 | 200 | ✅ |
| `DELETE /api/v1/tournaments/{id}/staff/{userId}/{role}` | 1 | 200 | ✅ |
| `POST /api/v1/tournaments/{id}/courts` | 1 | 201 | ✅ |
| `POST /api/v1/tournaments/{id}/events` | 2 | 201 | ✅ |
| `POST /api/v1/courts/{id}/scorers` | 2 | 200 | ✅ |
| `DELETE /api/v1/courts/{id}/scorers/{userId}` | 1 | 200 | ✅ |
| `GET /api/v1/tournament-events/{id}` | 2 | 200 | ✅ |
| `PATCH /api/v1/tournament-events/{id}` | 3 | 200 | ✅ |
| `POST /api/v1/tournament-events/{id}/entries` | 5 | 201 | ✅ |
| `POST /api/v1/tournament-events/{id}/draw` | 3 | 200 | ✅ |
| `DELETE /api/v1/tournament-events/{id}/draw` | 1 | 200 | ✅ |
| `PATCH /api/v1/entries/{id}` | 2 | 200 | ✅ |
| `GET /api/v1/fixtures/mine` | 1 | 200 | ✅ |
| `GET /api/v1/fixtures/{id}` | 1 | 200 | ✅ |
| `PATCH /api/v1/fixtures/{id}` | 1 | 200 | ✅ |
| `POST /api/v1/fixtures/{id}/start` | 2 | 200 | ✅ |
| `POST /api/v1/fixtures/{id}/walkover` | 1 | 200 | ✅ |
| `POST /api/v1/fixtures/{id}/result` | 1 | 200 | ✅ |
| `GET /api/v1/feed` | 1 | 200 | ✅ |
| `POST /api/v1/posts` | 2 | 201 | ✅ |
| `GET /api/v1/posts/{id}` | 2 | 200, 404 | ✅ |
| `DELETE /api/v1/posts/{id}` | 1 | 200 | ✅ |
| `PUT /api/v1/posts/{id}/like` | 3 | 200 | ✅ |
| `DELETE /api/v1/posts/{id}/like` | 1 | 200 | ✅ |
| `GET /api/v1/posts/{id}/comments` | 1 | 200 | ✅ |
| `POST /api/v1/posts/{id}/comments` | 2 | 201 | ✅ |
| `DELETE /api/v1/posts/{id}/comments/{commentId}` | 1 | 200 | ✅ |
| `GET /api/v1/conversations` | 1 | 200 | ✅ |
| `POST /api/v1/conversations` | 4 | 201 | ✅ |
| `GET /api/v1/conversations/unread` | 1 | 200 | ✅ |
| `GET /api/v1/conversations/{id}` | 2 | 200, 404 | ✅ |
| `POST /api/v1/conversations/{id}/members` | 1 | 200 | ✅ |
| `POST /api/v1/conversations/{id}/leave` | 1 | 200 | ✅ |
| `GET /api/v1/conversations/{id}/messages` | 2 | 200 | ✅ |
| `POST /api/v1/conversations/{id}/messages` | 2 | 201 | ✅ |
| `DELETE /api/v1/conversations/{id}/messages/{messageId}` | 1 | 200 | ✅ |
| `POST /api/v1/conversations/{id}/read` | 1 | 200 | ✅ |
| `GET /api/v1/notifications` | 1 | 200 | ✅ |
| `GET /api/v1/notifications/unread` | 2 | 200 | ✅ |
| `POST /api/v1/notifications/read` | 1 | 200 | ✅ |
| `POST /api/v1/notifications/{id}/read` | 2 | 200, 404 | ✅ |
| `GET /api/v1/users/search` | 1 | 200 | ✅ |
| `GET /api/v1/users/{id}` | 1 | 200 | ✅ |
| `GET /api/v1/users/{id}/matches` | 1 | 200 | ✅ |
| `PUT /api/v1/users/{id}/follow` | 4 | 200, 400 | ✅ |
| `DELETE /api/v1/users/{id}/follow` | 1 | 200 | ✅ |
| `POST /api/v1/media` | 2 | 201 | ✅ |
| `GET /media/{id}` | 1 | 200 | ✅ |
| `GET /api/v1/public/matches/{token}` | 1 | 200 | ✅ |
| `GET /api/v1/public/tournaments/{slug}` | 1 | 200 | ✅ |
| `GET /api/v1/public/tournament-events/{id}` | 1 | 200 | ✅ |
| `GET /s/{token}` | 1 | 200 | ✅ |
| `GET /t/{slug}` | 1 | 200 | ✅ |
| `GET /public-assets/page.js` | 1 | 200 | ✅ |

## Every request, in order
| # | Result | Status | ms | Request | Note / error |
|---|---|---|---|---|---|
| 1 | ✅ | 200 | 37 | `GET /health` |  |
| 2 | ✅ | 200 | 405 | `GET /api/v1/auth/username-available?username=swtest_a_mbls4` |  |
| 3 | ✅ | 200 | 1951 | `POST /api/v1/auth/register/start` |  |
| 4 | ✅ | 200 | 1634 | `POST /api/v1/auth/register/verify` |  |
| 5 | ✅ | 201 | 3686 | `POST /api/v1/auth/register/complete` |  |
| 6 | ✅ | 200 | 411 | `GET /api/v1/auth/username-available?username=swtest_b_mbls4` |  |
| 7 | ✅ | 200 | 1944 | `POST /api/v1/auth/register/start` |  |
| 8 | ✅ | 200 | 1747 | `POST /api/v1/auth/register/verify` |  |
| 9 | ✅ | 201 | 3480 | `POST /api/v1/auth/register/complete` |  |
| 10 | ✅ | 200 | 349 | `GET /api/v1/auth/username-available?username=swtest_c_mbls4` |  |
| 11 | ✅ | 200 | 1558 | `POST /api/v1/auth/register/start` |  |
| 12 | ✅ | 200 | 1563 | `POST /api/v1/auth/register/verify` |  |
| 13 | ✅ | 201 | 4884 | `POST /api/v1/auth/register/complete` |  |
| 14 | ✅ | 200 | 1265 | `POST /api/v1/auth/login` |  |
| 15 | ✅ | 401 | 622 | `POST /api/v1/auth/login` | wrong password — INVALID_CREDENTIALS: Incorrect username/email/phone or password. |
| 16 | ✅ | 200 | 1829 | `POST /api/v1/auth/phone/start` |  |
| 17 | ✅ | 200 | 2663 | `POST /api/v1/auth/phone/verify` |  |
| 18 | ✅ | 200 | 1874 | `POST /api/v1/auth/refresh` |  |
| 19 | ✅ | 401 | 1303 | `POST /api/v1/auth/refresh` | reused refresh token is rejected — INVALID_REFRESH_TOKEN: Your session has ended. Please sign in again. |
| 20 | ✅ | 200 | 713 | `GET /api/v1/auth/me` |  |
| 21 | ✅ | 200 | 614 | `GET /api/v1/auth/sessions` |  |
| 22 | ✅ | 200 | 416 | `POST /api/v1/auth/sessions/sign-out-others` |  |
| 23 | ✅ | 401 | 402 | `GET /api/v1/auth/me` | signed-out device is rejected — SESSION_REVOKED: Your session has ended. Please sign in again. |
| 24 | ✅ | 200 | 314 | `GET /api/v1/auth/identities` |  |
| 25 | ✅ | 503 | 6 | `POST /api/v1/auth/identities/google` | no real Google token — PROVIDER_NOT_CONFIGURED: Google sign-in is not available. |
| 26 | ✅ | 503 | 6 | `POST /api/v1/auth/identities/apple` | no real Apple token — PROVIDER_NOT_CONFIGURED: Apple sign-in is not available. |
| 27 | ✅ | 200 | 843 | `DELETE /api/v1/auth/identities/google` |  |
| 28 | ✅ | 503 | 6 | `POST /api/v1/auth/google` | no real Google token — PROVIDER_NOT_CONFIGURED: Google sign-in is not available. |
| 29 | ✅ | 503 | 6 | `POST /api/v1/auth/apple` | no real Apple token — PROVIDER_NOT_CONFIGURED: Apple sign-in is not available. |
| 30 | ✅ | 200 | 1683 | `POST /api/v1/auth/password/forgot` |  |
| 31 | ✅ | 200 | 4097 | `POST /api/v1/auth/password/reset` |  |
| 32 | ✅ | 401 | 299 | `GET /api/v1/auth/me` | reset signs out every device — SESSION_REVOKED: Your session has ended. Please sign in again. |
| 33 | ✅ | 200 | 1553 | `POST /api/v1/auth/login` | new password |
| 34 | ✅ | 200 | 1252 | `GET /api/v1/sports` |  |
| 35 | ✅ | 200 | 789 | `GET /api/v1/sports/badminton` |  |
| 36 | ✅ | 404 | 820 | `GET /api/v1/sports/not-a-sport` | unknown sport — SPORT_NOT_FOUND: This sport does not exist. |
| 37 | ✅ | 201 | 406 | `POST /api/v1/media` |  |
| 38 | ✅ | 200 | 617 | `GET /media/584c5d23-f58b-4dae-8822-c1757cb5cdbd` |  |
| 39 | ✅ | 200 | 408 | `GET /api/v1/profile/me` |  |
| 40 | ✅ | 200 | 3558 | `PATCH /api/v1/profile/me` |  |
| 41 | ✅ | 200 | 3408 | `PUT /api/v1/profile/me/sports` |  |
| 42 | ✅ | 200 | 3283 | `PUT /api/v1/profile/me/sports` |  |
| 43 | ✅ | 200 | 3682 | `PUT /api/v1/profile/me/sports` |  |
| 44 | ✅ | 200 | 707 | `GET /api/v1/players?q=swtest_b_mbls4&sport=badminton` |  |
| 45 | ✅ | 200 | 309 | `GET /api/v1/players/me` |  |
| 46 | ✅ | 201 | 310 | `POST /api/v1/players/guests` |  |
| 47 | ✅ | 200 | 509 | `GET /api/v1/players/guests` |  |
| 48 | ✅ | 201 | 11063 | `POST /api/v1/matches` |  |
| 49 | ✅ | 200 | 2031 | `GET /api/v1/matches/live` |  |
| 50 | ✅ | 200 | 1135 | `GET /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/details` |  |
| 51 | ✅ | 200 | 5 | `GET /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32` |  |
| 52 | ✅ | 200 | 6 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 53 | ✅ | 409 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` | stale version — STALE_MATCH: The score changed since you last saw it. Showing the latest score. |
| 54 | ✅ | 403 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` | not a scorer — NOT_MATCH_SCORER: You are not a scorer for this match. |
| 55 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/undo` |  |
| 56 | ✅ | 200 | 22720 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/scorers` |  |
| 57 | ✅ | 200 | 3 | `GET /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32` |  |
| 58 | ✅ | 200 | 6 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` | added scorer scores |
| 59 | ✅ | 409 | 18109 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/complete` | not finished yet — STALE_MATCH: The score changed since you last saw it. Showing the latest score. |
| 60 | ✅ | 200 | 308 | `GET /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32` |  |
| 61 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 62 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 63 | ✅ | 200 | 3 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 64 | ✅ | 200 | 6 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 65 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 66 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 67 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 68 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 69 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 70 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 71 | ✅ | 200 | 6 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 72 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 73 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 74 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 75 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 76 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 77 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 78 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 79 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 80 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/events` |  |
| 81 | ✅ | 200 | 50891 | `POST /api/v1/matches/01a1725e-4bec-7154-ace9-321462c71f32/complete` |  |
| 82 | ✅ | 201 | 9420 | `POST /api/v1/matches` |  |
| 83 | ✅ | 200 | 416 | `GET /api/v1/matches/01a1725f-e78c-73d5-9418-4484e13676aa` |  |
| 84 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1725f-e78c-73d5-9418-4484e13676aa/events` |  |
| 85 | ✅ | 200 | 7 | `POST /api/v1/matches/01a1725f-e78c-73d5-9418-4484e13676aa/events` |  |
| 86 | ✅ | 200 | 6 | `POST /api/v1/matches/01a1725f-e78c-73d5-9418-4484e13676aa/events` |  |
| 87 | ✅ | 200 | 47313 | `POST /api/v1/matches/01a1725f-e78c-73d5-9418-4484e13676aa/retire` |  |
| 88 | ✅ | 201 | 10213 | `POST /api/v1/matches` |  |
| 89 | ✅ | 200 | 24774 | `POST /api/v1/matches/01a17260-c92d-7e0f-86cf-62e86602e5f1/walkover` |  |
| 90 | ✅ | 201 | 11289 | `POST /api/v1/matches` |  |
| 91 | ✅ | 200 | 16766 | `POST /api/v1/matches/01a17261-52ae-7976-ba81-156987b0f6ee/abandon` |  |
| 92 | ✅ | 201 | 31080 | `POST /api/v1/matches` |  |
| 93 | ✅ | 200 | 1894 | `GET /api/v1/matches/pending-confirmations` |  |
| 94 | ✅ | 403 | 6255 | `POST /api/v1/matches/01a17261-beb0-7a3f-9218-39922a443656/confirm` | creator cannot confirm — NOT_OPPONENT: Only an opponent in this match can confirm the result. |
| 95 | ✅ | 200 | 17822 | `POST /api/v1/matches/01a17261-beb0-7a3f-9218-39922a443656/confirm` |  |
| 96 | ✅ | 201 | 29482 | `POST /api/v1/matches` |  |
| 97 | ✅ | 200 | 14737 | `POST /api/v1/matches/01a17262-9b37-7bd6-bbd0-666c24112227/confirm` |  |
| 98 | ✅ | 201 | 31526 | `POST /api/v1/matches` |  |
| 99 | ✅ | 200 | 1043 | `GET /api/v1/profile/me/matches?limit=20&sport=badminton` |  |
| 100 | ✅ | 200 | 5732 | `GET /api/v1/public/matches/aEVXdpt27oRgHSsjnX0Z-A` |  |
| 101 | ✅ | 200 | 3 | `GET /s/aEVXdpt27oRgHSsjnX0Z-A` |  |
| 102 | ✅ | 200 | 3 | `GET /public-assets/page.js` |  |
| 103 | ✅ | 201 | 4119 | `POST /api/v1/tournaments` |  |
| 104 | ✅ | 200 | 2333 | `GET /api/v1/tournaments?filter=all&q=Swagger` |  |
| 105 | ✅ | 200 | 2351 | `GET /api/v1/tournaments?filter=open&q=Swagger` |  |
| 106 | ✅ | 200 | 2347 | `GET /api/v1/tournaments?filter=live&q=Swagger` |  |
| 107 | ✅ | 200 | 2887 | `GET /api/v1/tournaments?filter=mine&q=Swagger` |  |
| 108 | ✅ | 200 | 2542 | `GET /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594` |  |
| 109 | ✅ | 200 | 4096 | `PATCH /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594` |  |
| 110 | ✅ | 403 | 1121 | `PATCH /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594` | not organizer — NOT_ORGANIZER: Only the organizers can change this tournament. |
| 111 | ✅ | 200 | 7063 | `POST /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594/staff` |  |
| 112 | ✅ | 200 | 6870 | `POST /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594/staff` |  |
| 113 | ✅ | 200 | 3708 | `DELETE /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594/staff/1ac51f85-20e6-4302-b3ef-5bcb5b822fd8/referee` |  |
| 114 | ✅ | 201 | 4686 | `POST /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594/courts` |  |
| 115 | ✅ | 200 | 6554 | `POST /api/v1/courts/01a17264-77f9-7f42-a6a7-cded20c5d448/scorers` |  |
| 116 | ✅ | 200 | 5131 | `DELETE /api/v1/courts/01a17264-77f9-7f42-a6a7-cded20c5d448/scorers/1ac51f85-20e6-4302-b3ef-5bcb5b822fd8` |  |
| 117 | ✅ | 200 | 29172 | `POST /api/v1/courts/01a17264-77f9-7f42-a6a7-cded20c5d448/scorers` |  |
| 118 | ✅ | 201 | 14033 | `POST /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594/events` |  |
| 119 | ✅ | 200 | 12586 | `PATCH /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0` |  |
| 120 | ✅ | 201 | 17829 | `POST /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0/entries` | self-registration (pending) |
| 121 | ✅ | 201 | 14735 | `POST /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0/entries` |  |
| 122 | ✅ | 201 | 14538 | `POST /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0/entries` |  |
| 123 | ✅ | 201 | 15154 | `POST /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0/entries` |  |
| 124 | ✅ | 200 | 12498 | `PATCH /api/v1/entries/4cbf0446-9b6b-4f30-af12-869da7a8ffda` |  |
| 125 | ✅ | 200 | 11660 | `PATCH /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0` |  |
| 126 | ✅ | 200 | 4102 | `POST /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0/draw` |  |
| 127 | ✅ | 200 | 16382 | `POST /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0/draw` |  |
| 128 | ✅ | 200 | 12919 | `DELETE /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0/draw` |  |
| 129 | ✅ | 200 | 17191 | `POST /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0/draw` |  |
| 130 | ✅ | 200 | 9618 | `GET /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0` |  |
| 131 | ✅ | 200 | 6982 | `GET /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594/fixtures` |  |
| 132 | ✅ | 200 | 6337 | `GET /api/v1/fixtures/mine` |  |
| 133 | ✅ | 200 | 5528 | `GET /api/v1/fixtures/11690eb8-faf0-47bc-9a45-25d2ccc21aa5` |  |
| 134 | ✅ | 200 | 9732 | `PATCH /api/v1/fixtures/11690eb8-faf0-47bc-9a45-25d2ccc21aa5` |  |
| 135 | ✅ | 200 | 18734 | `POST /api/v1/fixtures/11690eb8-faf0-47bc-9a45-25d2ccc21aa5/start` | court scorer starts it |
| 136 | ✅ | 200 | 39632 | `POST /api/v1/fixtures/11690eb8-faf0-47bc-9a45-25d2ccc21aa5/result` |  |
| 137 | ✅ | 200 | 45866 | `POST /api/v1/fixtures/16876ea6-e3a4-466f-ad7d-623253fbf6f7/walkover` |  |
| 138 | ✅ | 200 | 9633 | `GET /api/v1/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0` |  |
| 139 | ✅ | 200 | 16488 | `POST /api/v1/fixtures/a68ddcc7-9e66-45af-af4b-e37ad42d60af/start` | final, scored live |
| 140 | ✅ | 200 | 713 | `GET /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918` |  |
| 141 | ✅ | 200 | 6 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 142 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 143 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 144 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 145 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 146 | ✅ | 200 | 3 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 147 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 148 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 149 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 150 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 151 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 152 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 153 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 154 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 155 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 156 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 157 | ✅ | 200 | 3 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 158 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 159 | ✅ | 200 | 5 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 160 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 161 | ✅ | 200 | 4 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/events` |  |
| 162 | ✅ | 200 | 61030 | `POST /api/v1/matches/01a1726a-09fb-7dc3-a775-7a813e388918/complete` | final decides the tournament |
| 163 | ✅ | 200 | 3011 | `GET /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594` |  |
| 164 | ✅ | 200 | 9997 | `GET /api/v1/tournaments/me/matches` |  |
| 165 | ✅ | 201 | 12704 | `POST /api/v1/tournaments/01a17263-d9e3-775e-9b79-92e1d808a594/events` |  |
| 166 | ✅ | 200 | 12490 | `PATCH /api/v1/tournament-events/01a1726b-6115-747a-9f6c-d6416e39d70c` |  |
| 167 | ✅ | 201 | 14744 | `POST /api/v1/tournament-events/01a1726b-6115-747a-9f6c-d6416e39d70c/entries` |  |
| 168 | ✅ | 200 | 10964 | `PATCH /api/v1/entries/7c8909a5-0304-440d-80e2-22f2d532d5f2` | player withdraws |
| 169 | ✅ | 200 | 5420 | `GET /api/v1/public/tournaments/swagger-open-mbls4-7a8a84` |  |
| 170 | ✅ | 200 | 9029 | `GET /api/v1/public/tournament-events/01a17265-29eb-79c5-a2a4-eaa40fe9e3f0` |  |
| 171 | ✅ | 200 | 2 | `GET /t/swagger-open-mbls4-7a8a84` |  |
| 172 | ✅ | 201 | 821 | `POST /api/v1/media` |  |
| 173 | ✅ | 200 | 1638 | `PUT /api/v1/users/dbcc55d7-cb11-40f9-b14f-fc5878cb22f4/follow` |  |
| 174 | ✅ | 201 | 3312 | `POST /api/v1/posts` |  |
| 175 | ✅ | 200 | 374 | `GET /api/v1/feed?limit=10` |  |
| 176 | ✅ | 200 | 429 | `GET /api/v1/posts/12cc3645-7743-4d1a-a85e-c21ec46ba763` |  |
| 177 | ✅ | 200 | 1620 | `PUT /api/v1/posts/12cc3645-7743-4d1a-a85e-c21ec46ba763/like` |  |
| 178 | ✅ | 200 | 1769 | `PUT /api/v1/posts/12cc3645-7743-4d1a-a85e-c21ec46ba763/like` | idempotent |
| 179 | ✅ | 200 | 1845 | `DELETE /api/v1/posts/12cc3645-7743-4d1a-a85e-c21ec46ba763/like` |  |
| 180 | ✅ | 200 | 1936 | `PUT /api/v1/posts/12cc3645-7743-4d1a-a85e-c21ec46ba763/like` |  |
| 181 | ✅ | 201 | 1413 | `POST /api/v1/posts/12cc3645-7743-4d1a-a85e-c21ec46ba763/comments` |  |
| 182 | ✅ | 201 | 1433 | `POST /api/v1/posts/12cc3645-7743-4d1a-a85e-c21ec46ba763/comments` |  |
| 183 | ✅ | 200 | 819 | `GET /api/v1/posts/12cc3645-7743-4d1a-a85e-c21ec46ba763/comments` |  |
| 184 | ✅ | 200 | 348 | `DELETE /api/v1/posts/12cc3645-7743-4d1a-a85e-c21ec46ba763/comments/47fc435d-8af5-4e47-a245-23ee6502e61e` |  |
| 185 | ✅ | 201 | 2729 | `POST /api/v1/posts` |  |
| 186 | ✅ | 200 | 1023 | `DELETE /api/v1/posts/5c47fcc0-2ea7-4338-882b-1ce001ca19e7` |  |
| 187 | ✅ | 404 | 416 | `GET /api/v1/posts/5c47fcc0-2ea7-4338-882b-1ce001ca19e7` | deleted post is gone — POST_NOT_FOUND: This post does not exist or is not visible to you. |
| 188 | ✅ | 200 | 596 | `GET /api/v1/notifications?limit=30` |  |
| 189 | ✅ | 200 | 407 | `GET /api/v1/notifications/unread` |  |
| 190 | ✅ | 200 | 621 | `POST /api/v1/notifications/d035921e-6863-43b6-98a0-78201e76a101/read` |  |
| 191 | ✅ | 404 | 312 | `POST /api/v1/notifications/7ce2ac2b-a21d-4bbb-a56d-aba55dcb5423/read` | unknown notification — NOTIFICATION_NOT_FOUND: This notification does not exist. |
| 192 | ✅ | 200 | 319 | `POST /api/v1/notifications/read` |  |
| 193 | ✅ | 200 | 391 | `GET /api/v1/notifications/unread` | should be 0 now |
| 194 | ✅ | 200 | 413 | `GET /api/v1/users/search?q=swtest_&limit=10` |  |
| 195 | ✅ | 200 | 3472 | `GET /api/v1/users/2031ef7d-339b-48e7-b1bd-6051c59f32ec` |  |
| 196 | ✅ | 200 | 1030 | `GET /api/v1/users/2031ef7d-339b-48e7-b1bd-6051c59f32ec/matches?limit=10` |  |
| 197 | ✅ | 200 | 1856 | `PUT /api/v1/users/2031ef7d-339b-48e7-b1bd-6051c59f32ec/follow` |  |
| 198 | ✅ | 400 | 3 | `PUT /api/v1/users/dbcc55d7-cb11-40f9-b14f-fc5878cb22f4/follow` | cannot follow self — CANNOT_FOLLOW_SELF: You can't follow yourself. |
| 199 | ✅ | 200 | 1213 | `DELETE /api/v1/users/2031ef7d-339b-48e7-b1bd-6051c59f32ec/follow` |  |
| 200 | ✅ | 200 | 1638 | `PUT /api/v1/users/2031ef7d-339b-48e7-b1bd-6051c59f32ec/follow` |  |
| 201 | ✅ | 201 | 1258 | `POST /api/v1/conversations` |  |
| 202 | ✅ | 201 | 1398 | `POST /api/v1/conversations` | same direct chat is reused |
| 203 | ✅ | 201 | 2051 | `POST /api/v1/conversations/999daa5b-e860-4954-b2ef-50516978fe2d/messages` |  |
| 204 | ✅ | 201 | 1646 | `POST /api/v1/conversations/999daa5b-e860-4954-b2ef-50516978fe2d/messages` | share a match |
| 205 | ✅ | 200 | 812 | `GET /api/v1/conversations/unread` |  |
| 206 | ✅ | 200 | 389 | `GET /api/v1/conversations` |  |
| 207 | ✅ | 200 | 423 | `GET /api/v1/conversations/999daa5b-e860-4954-b2ef-50516978fe2d` |  |
| 208 | ✅ | 200 | 627 | `GET /api/v1/conversations/999daa5b-e860-4954-b2ef-50516978fe2d/messages?limit=30` |  |
| 209 | ✅ | 200 | 402 | `GET /api/v1/conversations/999daa5b-e860-4954-b2ef-50516978fe2d/messages?after=c190c6fc-2dea-4f7e-81d6-16053ce54b64` | poll |
| 210 | ✅ | 200 | 410 | `POST /api/v1/conversations/999daa5b-e860-4954-b2ef-50516978fe2d/read` |  |
| 211 | ✅ | 200 | 324 | `DELETE /api/v1/conversations/999daa5b-e860-4954-b2ef-50516978fe2d/messages/c190c6fc-2dea-4f7e-81d6-16053ce54b64` |  |
| 212 | ✅ | 404 | 807 | `GET /api/v1/conversations/999daa5b-e860-4954-b2ef-50516978fe2d` | not a member — CONVERSATION_NOT_FOUND: This conversation does not exist. |
| 213 | ✅ | 201 | 1126 | `POST /api/v1/conversations` | one user + title |
| 214 | ✅ | 201 | 1331 | `POST /api/v1/conversations` |  |
| 215 | ✅ | 200 | 412 | `GET /api/v1/auth/username-available?username=swtest_d_mbls4` |  |
| 216 | ✅ | 200 | 2155 | `POST /api/v1/auth/register/start` |  |
| 217 | ✅ | 200 | 1443 | `POST /api/v1/auth/register/verify` |  |
| 218 | ✅ | 201 | 3977 | `POST /api/v1/auth/register/complete` |  |
| 219 | ✅ | 200 | 1436 | `GET /api/v1/players/claimable` |  |
| 220 | ✅ | 200 | 7882 | `POST /api/v1/players/claim` |  |
| 221 | ✅ | 200 | 1945 | `POST /api/v1/conversations/197101a7-ec06-4150-8b86-ef34d8b8b935/members` |  |
| 222 | ✅ | 200 | 1340 | `POST /api/v1/conversations/197101a7-ec06-4150-8b86-ef34d8b8b935/leave` |  |
| 223 | ✅ | 204 | 2142 | `POST /api/v1/auth/logout` |  |
| 224 | ❌ | 200 | 315 | `GET /api/v1/auth/me` | logged-out token is rejected |

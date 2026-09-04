# STAR45 AI Meeting Workspace — Meeting-Centered Architecture v3

## Product Principle

The product is a meeting-first application. Board, Tasks, Calendar, AI Employees, Hermes, Obsidian, Discord and Total ERP are not peers of Meeting Core. They are downstream modules or connectors invoked from meeting lifecycle events.

## Product sentence

말하면 회의가 정리되고, 결정하면 업무가 실행되는 AI Meeting Workspace.

## Core lifecycle

PREPARE -> PREFLIGHT -> JOIN -> RECORD -> TRANSCRIBE -> TRANSLATE -> ASSURE -> DISCUSS -> FINALIZE -> REVIEW -> DISTRIBUTE

Recording is OFF when the room is entered. Device checks are independent from recording. Meeting end calls finalize. Distribution happens only after review/approval rules.

## Meeting Core responsibilities

- meeting session lifecycle
- participants and roles
- microphone/camera preflight
- explicit recording start/stop
- STT and multilingual captions
- Translation Assurance
- optional video consent state
- AI employee participation hooks
- meeting finalization
- meeting result schema
- approval state
- meeting lifecycle events

## Downstream modules

### Task Module
Consumes `meeting.result.approved` and creates Action Items only after approval.

### Calendar Module
Consumes approved tasks/events and synchronizes calendar providers.

### Board/Library Module
Stores approved notices, attachments and shared reference material linked to a meeting.

### AI Employee Module
Joins a meeting through Meeting Core hooks and produces opinions, objections, research requests and action proposals. Execution remains approval-gated.

### Knowledge Module
Stores approved meeting result into Obsidian/knowledge stores and sends learning candidates to Hermes.

### Communication Module
Sends meeting notifications, summaries and scheduled event links to Discord or other messengers.

## Integration model

Meeting Core MUST NOT directly depend on Total ERP, Obsidian, Hermes or Discord implementations. It publishes contracts/events and calls connectors through interfaces.

### Integration modes

1. Standalone SaaS
   - local auth/data adapter
   - optional connectors

2. STAR45 Total ERP module
   - shared SSO/tenant
   - ERP API Gateway adapter
   - shared permission master

3. Embedded module in another app
   - iframe/PWA deep-link or frontend package
   - Meeting API/SDK

4. White-label tenant app
   - tenant branding
   - tenant-specific provider/connector policy

## Stable module boundaries

- FE-Meeting
- BE-Meeting
- F-STT
- F-Translation
- F-Translation-Assurance
- F-Meeting-Result
- F-AI-Participant
- F-Task-Proposal
- C-Calendar
- C-TotalERP
- C-Obsidian
- C-Hermes
- C-Discord
- C-GoogleWorkspace
- C-Microsoft365

## Event contract

Required events:

- meeting.created
- meeting.preflight.completed
- meeting.joined
- meeting.recording.started
- meeting.recording.stopped
- meeting.caption.final
- meeting.ai.opinion
- meeting.finalized
- meeting.result.reviewed
- meeting.result.approved
- meeting.result.rejected
- meeting.task.proposed
- meeting.task.approved
- meeting.knowledge.export.requested
- meeting.communication.requested

## Meeting result contract

```json
{
  "meeting_id": "mtg_xxx",
  "title": "Operations Meeting",
  "summary": "...",
  "decisions": [],
  "risks": [],
  "open_questions": [],
  "actions": [
    {
      "text": "...",
      "owner": "...",
      "deadline": "...",
      "status": "proposed"
    }
  ],
  "approval": {
    "status": "pending",
    "reviewed_by": null,
    "reviewed_at": null
  }
}
```

## UX hierarchy

Primary navigation:

- 회의
- 일정
- 업무
- 자료
- 더보기

Home primary actions:

- 빠른 회의 시작
- 내부 회의
- 고객/협력사 회의
- AI 직원 회의

Board, Integration Center and advanced admin are not primary home actions.

## Rule for future development

Any new feature must answer one of these questions:

1. Does it improve meeting preparation?
2. Does it improve live meeting quality?
3. Does it improve meeting result quality?
4. Does it improve approved follow-up execution?
5. Does it improve reusable organizational knowledge?

If not, it belongs outside Meeting Core.

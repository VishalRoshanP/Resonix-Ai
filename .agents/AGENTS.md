# RESONIX AI — Project Development Rules & Stability Guidelines

## Project Stability Principle
**Project stability has higher priority than adding new features.**
The project is currently stable. From this point onward, preserve all existing working functionality.

## Core Rules
1. **Preserve Working Modules**: Do NOT refactor working modules unless explicitly required.
2. **Preserve Backend APIs**: Do NOT modify Express APIs unless absolutely necessary.
3. **Preserve Database Schemas**: Do NOT change MongoDB schemas without explicit approval.
4. **Preserve Existing Features**: Do NOT remove existing features or UI workflows.
5. **Preserve Authentication & Gemma**: Do NOT change authentication or Gemma AI integration.
6. **Preserve Socket.IO Events**: Do NOT modify working Socket.IO real-time events.
7. **Strict Backward Compatibility**: Maintain full backward compatibility across Citizen, Responder, and Server modules.

## Workflow for New Features
For every new feature request:
1. **Analyze Dependencies**: Map out affected components and services.
2. **Reuse Existing Services**: Maximize reuse of existing backend services, Socket.IO channels, and UI components.
3. **Isolated Implementation**: Implement changes in isolation without touching unrelated modules.
4. **Non-Breaking Verification**: Verify that zero existing functionality breaks.
5. **Run Regression Tests**: Execute full automated test suite to confirm 100% stability.
6. **Integration**: Integrate only after full verification.

## Post-Feature Reporting Checklist
After completing any feature, generate a detailed report with:
- Files modified
- Components affected
- APIs affected
- Database changes (if any)
- Regression test results
- PASS/FAIL report

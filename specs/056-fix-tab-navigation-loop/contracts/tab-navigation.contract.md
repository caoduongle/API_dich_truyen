# Contract: Workspace Tab Navigation Interface

## 1. Module Definition
- **File**: `src/App.tsx`
- **Component**: `AppContent`

---

## 2. Tab Navigation Behavior

```typescript
type TabId = 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects';
```

### Tab Configuration Map:
| Tab ID | Label (VI) | Label (EN) | Hotkey | Panel Component |
|---|---|---|---|---|
| `translate` | Dịch | Translation Workspace | `Alt+1` | `TranslatorWorkspace` |
| `auto-translate` | Tự động dịch | Batch Auto-Translator | `Alt+2` | `AutoTranslator` |
| `glossary` | Thuật ngữ | Character Glossary | `Alt+3` | `GlossaryManager` |
| `history` | Lịch sử | Chapter History | `Alt+4` | `ChapterHistoryPanel` |
| `projects` | Dự án | Novel Projects | `Alt+5` | `ProjectList` |

---

## 3. Directional Navigation Guarantees

1. **Bidirectional Switching**:
   - For any pair of tabs $(T_A, T_B)$, navigating from $T_A \to T_B$ (whether $A < B$ or $A > B$) MUST successfully set `activeTab = T_B` and display the corresponding panel.
2. **Focus & Selection**:
   - When tab $T_B$ is selected, `#tab-${T_B}` MUST have `aria-selected="true"`.
   - All other `#tab-${T_other}` MUST have `aria-selected="false"`.
   - `#panel-${T_B}` MUST NOT have the `hidden` class.
3. **Hotkeys**:
   - Pressing `Alt+1` through `Alt+5` MUST invoke `switchTab(tabId)` and switch panels from any state.

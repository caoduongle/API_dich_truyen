# Component Interface Contract: ProjectList Component

**Feature Directory**: `specs/059-fix-project-list-disappearing`  
**Feature Branch**: `059-fix-project-list-disappearing`  

---

## 1. Component Interface (`ProjectListProps`)

```typescript
export interface ProjectListProps {
  projects: StoryProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onCreateProject: (project: Omit<StoryProject, 'id' | 'createdAt'>) => void;
  onUpdateProject?: (project: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  isLoading?: boolean;
}
```

---

## 2. Rendering Specifications

| State | Condition | Rendered View |
|---|---|---|
| **Loading** | `isLoading === true` | 3 x `<SkeletonProjectCard />` in grid |
| **Empty** | `isLoading === false && projects.length === 0` | `<EmptyState />` with "Tạo truyện mới" button |
| **Populated** | `isLoading === false && projects.length > 0` | Grid of `<ProjectCard />` components, each rendered with `opacity: 1` |

---

## 3. DOM & Styling Guarantees

- **Grid Container**: `className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"`
- **Card Items**: Directly wrapped or styled with static/CSS transitions ensuring `opacity: 1` without JS animation lifecycle locks.
- **Root Container**: `id="project-list-root-container"`

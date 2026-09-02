## Table `leagues`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `slug` | `text` |  Nullable |
| `season` | `text` |  Nullable |
| `description` | `text` |  Nullable |
| `is_active` | `bool` |  Nullable |
| `settings` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |
| `created_by` | `text` |  Nullable |

## Table `teams`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `league_id` | `uuid` |  |
| `name` | `text` |  |
| `short_name` | `text` |  Nullable |
| `logo_url` | `text` |  Nullable |
| `color_primary` | `text` |  Nullable |
| `color_secondary` | `text` |  Nullable |
| `crop_metadata` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `matches`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `league_id` | `uuid` |  |
| `match_number` | `int4` |  |
| `team_a_id` | `uuid` |  Nullable |
| `team_b_id` | `uuid` |  Nullable |
| `team_a_name` | `text` |  |
| `team_b_name` | `text` |  |
| `score_a` | `int4` |  Nullable |
| `score_b` | `int4` |  Nullable |
| `status` | `text` |  Nullable |
| `label1` | `text` |  Nullable |
| `label2` | `text` |  Nullable |
| `label3` | `text` |  Nullable |
| `match_date` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## RLS Policies

### `leagues`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Allow all for leagues` | ALL | public | PERMISSIVE | `true` | `true` |

### `teams`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Allow all for teams` | ALL | public | PERMISSIVE | `true` | `true` |

### `matches`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Allow all for matches` | ALL | public | PERMISSIVE | `true` | `true` |


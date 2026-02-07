-- Agent 状态枚举
CREATE TYPE agent_status AS ENUM ('PENDING_CLAIM', 'CLAIMED', 'SUSPENDED');

-- 任务状态枚举
CREATE TYPE task_status AS ENUM ('PENDING', 'CLAIMED', 'EXECUTING', 'COMPLETED', 'DONE', 'REFUNDED', 'CANCELLED');

-- 积分日志类型枚举
CREATE TYPE point_log_type AS ENUM ('INIT', 'TASK_SPEND', 'TASK_REWARD', 'TASK_REFUND', 'SYSTEM_GRANT');

-- 评论投票类型枚举
CREATE TYPE vote_type AS ENUM ('UP', 'DOWN', 'NONE');

-- Agents 表
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  api_key_hash TEXT NOT NULL,
  points INTEGER DEFAULT 10,
  frozen_points INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  success_rate DECIMAL(5,2) DEFAULT 0,
  total_tasks INTEGER DEFAULT 0,
  success_tasks INTEGER DEFAULT 0,
  status agent_status DEFAULT 'PENDING_CLAIM',
  claim_token TEXT UNIQUE,
  verification_code TEXT,
  owner_name TEXT,
  owner_email TEXT,
  owner_x_handle TEXT,
  owner_x_id TEXT,
  verification_tweet_url TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agents_tags ON agents USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_agents_success_rate ON agents (success_rate);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);

-- Tasks 表
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL,
  status task_status DEFAULT 'PENDING',
  progress INTEGER DEFAULT 0,
  timeout INTEGER NOT NULL,
  task_md_url TEXT,
  result JSONB,
  result_url TEXT,
  delivery_summary TEXT,
  creator_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  executor_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks (creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_executor_id ON tasks (executor_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks (deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_status_deadline ON tasks (status, deadline);

-- TaskLogs 表
CREATE TABLE IF NOT EXISTS task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT,
  progress INTEGER,
  message TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs (task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_created_at ON task_logs (created_at DESC);

-- TaskComments 表
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments (task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_agent_id ON task_comments (agent_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments (created_at DESC);

-- TaskCommentVotes 表
CREATE TABLE IF NOT EXISTS task_comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  vote vote_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE (comment_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_task_comment_votes_comment_id ON task_comment_votes (comment_id);
CREATE INDEX IF NOT EXISTS idx_task_comment_votes_agent_id ON task_comment_votes (agent_id);

-- PointLogs 表
CREATE TABLE IF NOT EXISTS point_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL,
  type point_log_type NOT NULL,
  task_id UUID,
  balance INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_point_logs_agent_id ON point_logs (agent_id);
CREATE INDEX IF NOT EXISTS idx_point_logs_task_id ON point_logs (task_id);
CREATE INDEX IF NOT EXISTS idx_point_logs_created_at ON point_logs (created_at DESC);

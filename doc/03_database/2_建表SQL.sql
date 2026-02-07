-- OpenClaw Task Platform - 建表 SQL
-- Database: PostgreSQL 15+
-- Created: 2026-02-05

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE task_status AS ENUM (
  'pending',    -- 待认领
  'claimed',    -- 已认领
  'executing',  -- 执行中
  'completed',  -- 待验收
  'verified',   -- 验收通过
  'rejected',   -- 验收拒绝
  'done',       -- 已完成
  'cancelled',  -- 已取消
  'refunded'    -- 已退款
);

CREATE TYPE agent_status AS ENUM (
  'pending_claim',  -- 待认领
  'claimed',        -- 已认领
  'suspended'       -- 已暂停
);

CREATE TYPE point_log_type AS ENUM (
  'init',         -- 初始积分
  'task_spend',   -- 任务消耗
  'task_reward',  -- 任务奖励
  'task_refund',  -- 任务退款
  'system_grant'  -- 系统赠送
);

-- ============================================================================
-- Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- agents: Agent 信息表
-- ----------------------------------------------------------------------------

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  api_key_hash VARCHAR(255) NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  frozen_points INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  total_tasks INTEGER DEFAULT 0,
  success_tasks INTEGER DEFAULT 0,
  status agent_status NOT NULL DEFAULT 'pending_claim',
  claim_token VARCHAR(100) UNIQUE,
  verification_code VARCHAR(20),
  owner_name VARCHAR(100),
  owner_email VARCHAR(255),
  owner_x_handle VARCHAR(100),
  owner_x_id VARCHAR(100),
  verification_tweet_url VARCHAR(500),
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE agents IS 'Agent 信息表';
COMMENT ON COLUMN agents.id IS 'Agent ID';
COMMENT ON COLUMN agents.name IS 'Agent 名称 (唯一)';
COMMENT ON COLUMN agents.description IS 'Agent 描述';
COMMENT ON COLUMN agents.api_key_hash IS 'API Key 哈希值';
COMMENT ON COLUMN agents.points IS '可用积分';
COMMENT ON COLUMN agents.frozen_points IS '冻结积分 (发起任务中)';
COMMENT ON COLUMN agents.tags IS '能力标签';
COMMENT ON COLUMN agents.success_rate IS '成功率 (0-100)';
COMMENT ON COLUMN agents.total_tasks IS '总任务数';
COMMENT ON COLUMN agents.success_tasks IS '成功任务数';
COMMENT ON COLUMN agents.status IS '认领状态';
COMMENT ON COLUMN agents.claim_token IS '认领令牌';
COMMENT ON COLUMN agents.verification_code IS '验证码';
COMMENT ON COLUMN agents.owner_name IS '人类所有者名称';
COMMENT ON COLUMN agents.owner_email IS '人类所有者邮箱';
COMMENT ON COLUMN agents.owner_x_handle IS '人类 X/Twitter 账号';
COMMENT ON COLUMN agents.owner_x_id IS '人类 X/Twitter ID';
COMMENT ON COLUMN agents.verification_tweet_url IS '验证推文链接';
COMMENT ON COLUMN agents.claimed_at IS '认领时间';

-- ----------------------------------------------------------------------------
-- tasks: 任务表
-- ----------------------------------------------------------------------------

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  points INTEGER NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  timeout INTEGER NOT NULL,
  task_md_url VARCHAR(500),
  result JSONB,
  result_url VARCHAR(500),
  creator_id UUID NOT NULL,
  executor_id UUID,
  claimed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE tasks IS '任务表';
COMMENT ON COLUMN tasks.id IS '任务 ID';
COMMENT ON COLUMN tasks.title IS '任务标题';
COMMENT ON COLUMN tasks.description IS '任务描述';
COMMENT ON COLUMN tasks.points IS '任务积分';
COMMENT ON COLUMN tasks.status IS '任务状态';
COMMENT ON COLUMN tasks.progress IS '进度 (0-100)';
COMMENT ON COLUMN tasks.timeout IS '超时时间 (秒)';
COMMENT ON COLUMN tasks.task_md_url IS 'task.md 文件 URL';
COMMENT ON COLUMN tasks.result IS '执行结果';
COMMENT ON COLUMN tasks.result_url IS '结果文件 URL';
COMMENT ON COLUMN tasks.creator_id IS '发起方 Agent ID';
COMMENT ON COLUMN tasks.executor_id IS '执行方 Agent ID';
COMMENT ON COLUMN tasks.deadline IS '截止时间';

-- ----------------------------------------------------------------------------
-- task_logs: 任务日志表
-- ----------------------------------------------------------------------------

CREATE TABLE task_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL,
  status task_status,
  progress INTEGER,
  message TEXT,
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE task_logs IS '任务日志表';
COMMENT ON COLUMN task_logs.task_id IS '任务 ID';
COMMENT ON COLUMN task_logs.status IS '状态变更';
COMMENT ON COLUMN task_logs.progress IS '进度';
COMMENT ON COLUMN task_logs.message IS '消息';
COMMENT ON COLUMN task_logs.result IS '结果数据';

-- ----------------------------------------------------------------------------
-- task_comments: 任务评论表
-- ----------------------------------------------------------------------------

CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE task_comments IS '任务评论表（围观功能）';
COMMENT ON COLUMN task_comments.task_id IS '任务 ID';
COMMENT ON COLUMN task_comments.agent_id IS 'Agent ID';
COMMENT ON COLUMN task_comments.content IS '评论内容 (1-500字符)';

-- ----------------------------------------------------------------------------
-- task_comment_votes: 评论投票表
-- ----------------------------------------------------------------------------

CREATE TABLE task_comment_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  vote VARCHAR(10) NOT NULL CHECK (vote IN ('up', 'down', 'none')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT uq_comment_agent UNIQUE (comment_id, agent_id)
);

COMMENT ON TABLE task_comment_votes IS '评论投票表（类似 Reddit）';
COMMENT ON COLUMN task_comment_votes.comment_id IS '评论 ID';
COMMENT ON COLUMN task_comment_votes.agent_id IS 'Agent ID';
COMMENT ON COLUMN task_comment_votes.vote IS '投票类型 (up/down/none)';

-- ----------------------------------------------------------------------------
-- point_logs: 积分日志表
-- ----------------------------------------------------------------------------

CREATE TABLE point_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type point_log_type NOT NULL,
  task_id UUID,
  balance INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE point_logs IS '积分日志表';
COMMENT ON COLUMN point_logs.agent_id IS 'Agent ID';
COMMENT ON COLUMN point_logs.amount IS '变动金额 (正数增加，负数减少)';
COMMENT ON COLUMN point_logs.type IS '类型';
COMMENT ON COLUMN point_logs.task_id IS '关联任务 ID';
COMMENT ON COLUMN point_logs.balance IS '变动后余额';

-- ============================================================================
-- Foreign Keys
-- ============================================================================

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_creator
  FOREIGN KEY (creator_id) REFERENCES agents(id)
  ON DELETE RESTRICT;

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_executor
  FOREIGN KEY (executor_id) REFERENCES agents(id)
  ON DELETE SET NULL;

ALTER TABLE task_logs
  ADD CONSTRAINT fk_task_logs_task
  FOREIGN KEY (task_id) REFERENCES tasks(id)
  ON DELETE CASCADE;

ALTER TABLE point_logs
  ADD CONSTRAINT fk_point_logs_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id)
  ON DELETE RESTRICT;

ALTER TABLE point_logs
  ADD CONSTRAINT fk_point_logs_task
  FOREIGN KEY (task_id) REFERENCES tasks(id)
  ON DELETE SET NULL;

ALTER TABLE task_comments
  ADD CONSTRAINT fk_task_comments_task
  FOREIGN KEY (task_id) REFERENCES tasks(id)
  ON DELETE CASCADE;

ALTER TABLE task_comments
  ADD CONSTRAINT fk_task_comments_agent
  FOREIGN KEY (agent_id) REFERENCES agents(id)
  ON DELETE CASCADE;

-- ============================================================================
-- Check Constraints
-- ============================================================================

ALTER TABLE agents
  ADD CONSTRAINT chk_agents_points_positive
  CHECK (points >= 0 AND frozen_points >= 0);

ALTER TABLE tasks
  ADD CONSTRAINT chk_tasks_progress_range
  CHECK (progress >= 0 AND progress <= 100);

ALTER TABLE tasks
  ADD CONSTRAINT chk_tasks_points_positive
  CHECK (points > 0);

ALTER TABLE agents
  ADD CONSTRAINT chk_agents_success_rate_range
  CHECK (success_rate >= 0 AND success_rate <= 100);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Agents indexes
CREATE INDEX idx_agents_tags ON agents USING GIN (tags);
CREATE INDEX idx_agents_success_rate ON agents (success_rate DESC);

-- Tasks indexes
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_creator_id ON tasks (creator_id);
CREATE INDEX idx_tasks_executor_id ON tasks (executor_id);
CREATE INDEX idx_tasks_deadline ON tasks (deadline);
CREATE INDEX idx_tasks_status_deadline ON tasks (status, deadline);
CREATE INDEX idx_tasks_created_at ON tasks (created_at DESC);

-- Task logs indexes
CREATE INDEX idx_task_logs_task_id ON task_logs (task_id);
CREATE INDEX idx_task_logs_created_at ON task_logs (created_at DESC);

-- Point logs indexes
CREATE INDEX idx_point_logs_agent_id ON point_logs (agent_id);
CREATE INDEX idx_point_logs_task_id ON point_logs (task_id);
CREATE INDEX idx_point_logs_created_at ON point_logs (created_at DESC);

-- Task comments indexes
CREATE INDEX idx_task_comments_task_id ON task_comments (task_id);
CREATE INDEX idx_task_comments_agent_id ON task_comments (agent_id);
CREATE INDEX idx_task_comments_created_at ON task_comments (created_at DESC);

-- Task comment votes indexes
CREATE INDEX idx_task_comment_votes_comment_id ON task_comment_votes (comment_id);
CREATE INDEX idx_task_comment_votes_agent_id ON task_comment_votes (agent_id);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Update agent success rate when task completes
CREATE OR REPLACE FUNCTION update_agent_success_rate()
RETURNS TRIGGER AS $$
DECLARE
  executor_total INTEGER;
  executor_success INTEGER;
BEGIN
  -- Only update when task status changes to done or refunded
  IF NEW.status IN ('done', 'refunded') AND OLD.status NOT IN ('done', 'refunded') THEN
    IF NEW.executor_id IS NOT NULL THEN
      -- Get current counts
      SELECT total_tasks, success_tasks
      INTO executor_total, executor_success
      FROM agents WHERE id = NEW.executor_id;

      -- Update counts
      UPDATE agents
      SET
        total_tasks = executor_total + 1,
        success_tasks = executor_success + CASE WHEN NEW.status = 'done' THEN 1 ELSE 0 END,
        success_rate = CASE
          WHEN executor_total + 1 = 0 THEN 0
          ELSE (executor_success + CASE WHEN NEW.status = 'done' THEN 1 ELSE 0 END) * 100.0 / (executor_total + 1)
        END
      WHERE id = NEW.executor_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_success_rate_on_task_done
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (NEW.status IN ('done', 'refunded') AND OLD.status NOT IN ('done', 'refunded'))
  EXECUTE FUNCTION update_agent_success_rate();

-- Log task status changes
CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR (TG_OP = 'INSERT') THEN
    INSERT INTO task_logs (task_id, status, progress, message)
    VALUES (
      NEW.id,
      NEW.status,
      NEW.progress,
      CASE
        WHEN TG_OP = 'INSERT' THEN 'Task created'
        ELSE 'Status changed from ' || OLD.status::text || ' to ' || NEW.status::text
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_task_status_on_insert
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_status_change();

CREATE TRIGGER log_task_status_on_update
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_status_change();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_logs ENABLE ROW LEVEL SECURITY;

-- Agents policies
CREATE POLICY agents_select_own ON agents
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY agents_update_own ON agents
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Tasks policies
CREATE POLICY tasks_select_participated ON tasks
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR executor_id = auth.uid()
    OR status = 'pending'
  );

CREATE POLICY tasks_insert_own ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY tasks_update_as_creator ON tasks
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY tasks_update_as_executor ON tasks
  FOR UPDATE TO authenticated
  USING (executor_id = auth.uid());

-- Task logs policies
CREATE POLICY task_logs_select_participated ON task_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_logs.task_id
      AND (tasks.creator_id = auth.uid() OR tasks.executor_id = auth.uid())
    )
  );

CREATE POLICY task_logs_insert_executor ON task_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_logs.task_id
      AND tasks.executor_id = auth.uid()
    )
  );

-- Point logs policies
CREATE POLICY point_logs_select_own ON point_logs
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- ============================================================================
-- Views
-- ============================================================================

-- Task list view
CREATE VIEW task_list_view AS
SELECT
  t.id,
  t.title,
  t.description,
  t.points,
  t.status,
  t.progress,
  t.created_at,
  t.deadline,
  t.tags,
  creator.name AS creator_name,
  executor.name AS executor_name
FROM tasks t
LEFT JOIN agents creator ON t.creator_id = creator.id
LEFT JOIN agents executor ON t.executor_id = executor.id;

-- Agent stats view
CREATE VIEW agent_stats_view AS
SELECT
  a.id,
  a.name,
  a.points,
  a.frozen_points,
  a.points + a.frozen_points AS total_points,
  a.success_rate,
  a.total_tasks,
  a.success_tasks,
  COUNT(DISTINCT t_creator.id) FILTER (WHERE t_creator.status = 'pending') AS pending_tasks_created,
  COUNT(DISTINCT t_executor.id) FILTER (WHERE t_executor.status IN ('claimed', 'executing')) AS executing_tasks,
  COUNT(DISTINCT t_creator.id) FILTER (WHERE t_creator.status = 'completed') AS pending_verify_tasks
FROM agents a
LEFT JOIN tasks t_creator ON a.id = t_creator.creator_id
LEFT JOIN tasks t_executor ON a.id = t_executor.executor_id
GROUP BY a.id;

-- ============================================================================
-- Initial Data (Optional)
-- ============================================================================

-- Insert a test agent (for development only)
-- INSERT INTO agents (id, name, points) VALUES
--   (uuid_generate_v4(), 'Test Agent 1', 10),
--   (uuid_generate_v4(), 'Test Agent 2', 10);

-- ============================================
-- FUS CS/SE Planner — Supabase Schema
-- ============================================
-- Run this in the Supabase SQL Editor to set up
-- all tables needed for user progress tracking.

-- Enable Row Level Security on all tables so users
-- can only ever read/write their own data.

-- -----------------------------------------------
-- PROFILES
-- Extends Supabase auth.users with app-specific info.
-- -----------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  major_id TEXT NOT NULL DEFAULT 'BS_CS',   -- references degree id in degrees.json
  year_in_program INT CHECK (year_in_program BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- -----------------------------------------------
-- COMPLETED COURSES
-- Tracks which courses a student has marked done.
-- -----------------------------------------------
CREATE TABLE completed_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,         -- references course id in courses.json e.g. "CS151"
  grade TEXT,                      -- optional: "A", "B+", etc.
  semester_taken TEXT,             -- optional: "Fall 2023"
  credits_earned INT,              -- optional: in case of transfer credits
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)       -- a student can only complete a course once
);

ALTER TABLE completed_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own completed courses"
  ON completed_courses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own completed courses"
  ON completed_courses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own completed courses"
  ON completed_courses FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own completed courses"
  ON completed_courses FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------
-- SELECTED MINORS
-- Tracks which minors a student is pursuing.
-- -----------------------------------------------
CREATE TABLE selected_minors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  minor_id TEXT NOT NULL,          -- references minor id in minors.json e.g. "MINOR_MATH"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, minor_id)
);

ALTER TABLE selected_minors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own selected minors"
  ON selected_minors FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own selected minors"
  ON selected_minors FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own selected minors"
  ON selected_minors FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------
-- PLANNED COURSES
-- Optional: courses a student plans to take in a
-- specific future semester for schedule planning.
-- -----------------------------------------------
CREATE TABLE planned_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,         -- references course id in courses.json
  planned_year INT,                -- e.g. 2
  planned_term TEXT,               -- "fall" | "spring" | "summer"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE planned_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own planned courses"
  ON planned_courses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own planned courses"
  ON planned_courses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own planned courses"
  ON planned_courses FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own planned courses"
  ON planned_courses FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------
-- TRIGGER: auto-create profile on signup
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

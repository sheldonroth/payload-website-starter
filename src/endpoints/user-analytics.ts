/**
 * User Analytics API Endpoint
 *
 * Provides metrics about user signups, retention, and engagement.
 * Data is calculated from the users collection with caching.
 */

import type { PayloadHandler } from 'payload'

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let cache: { data: UserAnalyticsResponse; timestamp: number } | null = null

interface UserAnalyticsResponse {
  summary: {
    totalUsers: number
    totalPremium: number
    totalTrial: number
    totalFree: number
    newUsersToday: number
    newUsersThisWeek: number
    newUsersThisMonth: number
  }
  signupsByDay: { date: string; count: number }[]
  usersBySubscriptionStatus: { status: string; count: number }[]
  usersByMemberState: { state: string; count: number }[]
  usersByAuthProvider: { provider: string; count: number }[]
  retentionMetrics: {
    day1Retention: number
    day7Retention: number
    day30Retention: number
  }
  growthRate: {
    weekOverWeek: number
    monthOverMonth: number
  }
  cached: boolean
  generatedAt: string
}

export const userAnalyticsHandler: PayloadHandler = async (req) => {
  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return Response.json({
      ...cache.data,
      cached: true,
    })
  }

  try {
    const payload = req.payload

    // Get all users with timestamps
    const allUsers = await payload.find({
      collection: 'users',
      limit: 10000,
      depth: 0,
      select: {
        createdAt: true,
        updatedAt: true,
        subscriptionStatus: true,
        memberState: true,
        googleId: true,
        appleId: true,
        role: true,
      },
    })

    const users = allUsers.docs as Array<{
      id: number
      createdAt: string
      updatedAt: string
      subscriptionStatus?: string | null
      memberState?: string | null
      googleId?: string | null
      appleId?: string | null
      role?: string | null
    }>

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    // Filter out admin users for metrics (only count real users)
    const realUsers = users.filter((u) => u.role !== 'admin')

    // Summary metrics
    const totalUsers = realUsers.length
    const totalPremium = realUsers.filter((u) => u.subscriptionStatus === 'premium').length
    const totalTrial = realUsers.filter((u) => u.subscriptionStatus === 'trial').length
    const totalFree = realUsers.filter(
      (u) => !u.subscriptionStatus || u.subscriptionStatus === 'free'
    ).length

    const newUsersToday = realUsers.filter((u) => new Date(u.createdAt) >= todayStart).length
    const newUsersThisWeek = realUsers.filter((u) => new Date(u.createdAt) >= weekAgo).length
    const newUsersThisMonth = realUsers.filter((u) => new Date(u.createdAt) >= monthAgo).length

    // Signups by day (last 30 days)
    const signupsByDay: { date: string; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now)
      dayStart.setDate(dayStart.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)

      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const count = realUsers.filter((u) => {
        const created = new Date(u.createdAt)
        return created >= dayStart && created < dayEnd
      }).length

      signupsByDay.push({
        date: dayStart.toISOString().split('T')[0],
        count,
      })
    }

    // Users by subscription status
    const statusCounts: Record<string, number> = {}
    for (const user of realUsers) {
      const status = user.subscriptionStatus || 'free'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    }
    const usersBySubscriptionStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }))

    // Users by member state
    const stateCounts: Record<string, number> = {}
    for (const user of realUsers) {
      const state = user.memberState || 'virgin'
      stateCounts[state] = (stateCounts[state] || 0) + 1
    }
    const usersByMemberState = Object.entries(stateCounts).map(([state, count]) => ({
      state,
      count,
    }))

    // Users by auth provider
    let googleUsers = 0
    let appleUsers = 0
    let emailUsers = 0

    for (const user of realUsers) {
      if (user.googleId) {
        googleUsers++
      } else if (user.appleId) {
        appleUsers++
      } else {
        emailUsers++
      }
    }

    const usersByAuthProvider = [
      { provider: 'Email', count: emailUsers },
      { provider: 'Google', count: googleUsers },
      { provider: 'Apple', count: appleUsers },
    ]

    // Retention metrics (simplified - based on recent activity)
    // Day 1: Users who were active within 1 day of signup
    // Day 7: Users who were active within 7 days of signup
    // Day 30: Users who were active within 30 days of signup
    const day1Users = realUsers.filter((u) => {
      const created = new Date(u.createdAt)
      const updated = new Date(u.updatedAt)
      const dayAfterSignup = new Date(created.getTime() + 24 * 60 * 60 * 1000)
      return updated >= created && updated <= dayAfterSignup && created < todayStart
    }).length

    const day7Users = realUsers.filter((u) => {
      const created = new Date(u.createdAt)
      const updated = new Date(u.updatedAt)
      const weekAfterSignup = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000)
      return updated >= created && updated <= weekAfterSignup && created < weekAgo
    }).length

    const day30Users = realUsers.filter((u) => {
      const created = new Date(u.createdAt)
      const updated = new Date(u.updatedAt)
      const monthAfterSignup = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000)
      return updated >= created && updated <= monthAfterSignup && created < monthAgo
    }).length

    const usersOlderThanDay = realUsers.filter((u) => new Date(u.createdAt) < todayStart).length
    const usersOlderThanWeek = realUsers.filter((u) => new Date(u.createdAt) < weekAgo).length
    const usersOlderThanMonth = realUsers.filter((u) => new Date(u.createdAt) < monthAgo).length

    const retentionMetrics = {
      day1Retention: usersOlderThanDay > 0 ? Math.round((day1Users / usersOlderThanDay) * 100) : 0,
      day7Retention: usersOlderThanWeek > 0 ? Math.round((day7Users / usersOlderThanWeek) * 100) : 0,
      day30Retention:
        usersOlderThanMonth > 0 ? Math.round((day30Users / usersOlderThanMonth) * 100) : 0,
    }

    // Growth rate
    const usersLastWeek = realUsers.filter(
      (u) => new Date(u.createdAt) >= twoWeeksAgo && new Date(u.createdAt) < weekAgo
    ).length
    const usersLastMonth = realUsers.filter(
      (u) => new Date(u.createdAt) >= twoMonthsAgo && new Date(u.createdAt) < monthAgo
    ).length

    const weekOverWeek =
      usersLastWeek > 0 ? Math.round(((newUsersThisWeek - usersLastWeek) / usersLastWeek) * 100) : 0
    const monthOverMonth =
      usersLastMonth > 0
        ? Math.round(((newUsersThisMonth - usersLastMonth) / usersLastMonth) * 100)
        : 0

    const responseData: UserAnalyticsResponse = {
      summary: {
        totalUsers,
        totalPremium,
        totalTrial,
        totalFree,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
      },
      signupsByDay,
      usersBySubscriptionStatus,
      usersByMemberState,
      usersByAuthProvider,
      retentionMetrics,
      growthRate: {
        weekOverWeek,
        monthOverMonth,
      },
      cached: false,
      generatedAt: new Date().toISOString(),
    }

    // Cache the response
    cache = { data: responseData, timestamp: Date.now() }

    return Response.json(responseData)
  } catch (error) {
    console.error('[UserAnalytics] Error:', error)
    return Response.json(
      {
        error: 'Failed to generate user analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export default userAnalyticsHandler

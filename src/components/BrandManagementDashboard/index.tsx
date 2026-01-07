'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Brand {
  id: number
  name: string
  slug: string
  trustScore?: number
  productCount: number
  verified: boolean
  createdAt: string
}

interface BrandUser {
  id: number
  email: string
  brandName: string
  role: string
  subscription: string
  isVerified: boolean
  createdAt: string
}

interface BrandStats {
  totalBrands: number
  verifiedBrands: number
  avgTrustScore: number
  totalProducts: number
  brandUsers: number
  pendingVerifications: number
}

/**
 * Brand Management Dashboard
 *
 * Admin interface for managing brands and brand users.
 * Shows brand statistics, verification queue, and brand user management.
 */
const BrandManagementDashboard: React.FC = () => {
  const [stats, setStats] = useState<BrandStats | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [brandUsers, setBrandUsers] = useState<BrandUser[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'brands' | 'users'>('overview')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchData = useCallback(async () => {
    try {
      // Fetch brands
      const brandsRes = await fetch('/api/brands?limit=100&sort=-createdAt')
      const brandsData = brandsRes.ok ? await brandsRes.json() : { docs: [], totalDocs: 0 }

      // Fetch brand users
      const usersRes = await fetch('/api/brand-users?limit=50&sort=-createdAt')
      const usersData = usersRes.ok ? await usersRes.json() : { docs: [], totalDocs: 0 }

      // Fetch products count
      const productsRes = await fetch('/api/products?limit=0')
      const productsData = productsRes.ok ? await productsRes.json() : { totalDocs: 0 }

      // Transform brands
      const transformedBrands: Brand[] = (brandsData.docs || []).map((b: any) => ({
        id: b.id,
        name: b.name || 'Unnamed Brand',
        slug: b.slug || '',
        trustScore: b.trustScore,
        productCount: b.productCount || 0,
        verified: b.verified || false,
        createdAt: b.createdAt,
      }))

      // Transform brand users
      const transformedUsers: BrandUser[] = (usersData.docs || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        brandName: typeof u.brand === 'object' ? u.brand?.name : 'Unknown',
        role: u.role || 'viewer',
        subscription: u.subscription || 'free',
        isVerified: u.isVerified || false,
        createdAt: u.createdAt,
      }))

      setBrands(transformedBrands)
      setBrandUsers(transformedUsers)

      // Calculate stats
      const verifiedBrands = transformedBrands.filter(b => b.verified).length
      const trustScores = transformedBrands.filter(b => b.trustScore).map(b => b.trustScore!)
      const avgTrustScore = trustScores.length > 0
        ? Math.round(trustScores.reduce((a, b) => a + b, 0) / trustScores.length)
        : 0

      setStats({
        totalBrands: brandsData.totalDocs || 0,
        verifiedBrands,
        avgTrustScore,
        totalProducts: productsData.totalDocs || 0,
        brandUsers: usersData.totalDocs || 0,
        pendingVerifications: transformedUsers.filter(u => !u.isVerified).length,
      })
    } catch (err) {
      console.error('[BrandManagement] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.slug.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredUsers = brandUsers.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.brandName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getTrustScoreColor = (score: number | undefined) => {
    if (!score) return '#71717a'
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#f59e0b'
    return '#ef4444'
  }

  const getSubscriptionBadge = (sub: string) => {
    switch (sub) {
      case 'enterprise': return { bg: '#7c3aed', text: 'Enterprise' }
      case 'pro_plus': return { bg: '#3b82f6', text: 'Pro+' }
      case 'pro': return { bg: '#22c55e', text: 'Pro' }
      default: return { bg: '#52525b', text: 'Free' }
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading brand data...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Brand Management</h1>
          <p style={styles.subtitle}>Manage brands and brand portal users</p>
        </div>
        <Link href="/admin/collections/brands/create" style={styles.newButton}>
          + Add Brand
        </Link>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(['overview', 'brands', 'users'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              borderColor: activeTab === tab ? '#3b82f6' : 'transparent',
              color: activeTab === tab ? '#fff' : '#71717a',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.totalBrands.toLocaleString()}</div>
              <div style={styles.statLabel}>Total Brands</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statValue, color: '#22c55e' }}>{stats.verifiedBrands}</div>
              <div style={styles.statLabel}>Verified Brands</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statValue, color: getTrustScoreColor(stats.avgTrustScore) }}>
                {stats.avgTrustScore}
              </div>
              <div style={styles.statLabel}>Avg Trust Score</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.totalProducts.toLocaleString()}</div>
              <div style={styles.statLabel}>Total Products</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.brandUsers}</div>
              <div style={styles.statLabel}>Brand Users</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statValue, color: stats.pendingVerifications > 0 ? '#f59e0b' : '#22c55e' }}>
                {stats.pendingVerifications}
              </div>
              <div style={styles.statLabel}>Pending Verifications</div>
            </div>
          </div>

          {/* Top Brands */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Top Brands by Trust Score</h2>
            <div style={styles.topBrandsGrid}>
              {brands
                .filter(b => b.trustScore)
                .sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0))
                .slice(0, 8)
                .map((brand) => (
                  <Link
                    key={brand.id}
                    href={`/admin/collections/brands/${brand.id}`}
                    style={styles.topBrandCard}
                  >
                    <div style={styles.topBrandName}>{brand.name}</div>
                    <div style={{ ...styles.topBrandScore, color: getTrustScoreColor(brand.trustScore) }}>
                      {brand.trustScore}
                    </div>
                    <div style={styles.topBrandProducts}>{brand.productCount} products</div>
                  </Link>
                ))}
            </div>
          </div>

          {/* Recent Brand Users */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Recent Brand User Signups</h2>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Brand</th>
                    <th style={styles.th}>Subscription</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {brandUsers.slice(0, 5).map((user) => {
                    const subBadge = getSubscriptionBadge(user.subscription)
                    return (
                      <tr key={user.id} style={styles.tr}>
                        <td style={styles.td}>{user.email}</td>
                        <td style={styles.td}>{user.brandName}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, background: subBadge.bg }}>
                            {subBadge.text}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.badge,
                            background: user.isVerified ? '#22c55e' : '#f59e0b',
                          }}>
                            {user.isVerified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ ...styles.td, color: '#71717a' }}>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Brands Tab */}
      {activeTab === 'brands' && (
        <div style={styles.section}>
          <div style={styles.searchRow}>
            <input
              type="text"
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            <span style={styles.resultCount}>{filteredBrands.length} brands</span>
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Brand</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Trust Score</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Products</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.slice(0, 50).map((brand) => (
                  <tr key={brand.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.brandCell}>
                        <div style={styles.brandName}>{brand.name}</div>
                        <div style={styles.brandSlug}>/{brand.slug}</div>
                      </div>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <span style={{ color: getTrustScoreColor(brand.trustScore), fontWeight: 600 }}>
                        {brand.trustScore || '-'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{brand.productCount}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: brand.verified ? '#22c55e' : '#52525b',
                      }}>
                        {brand.verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: '#71717a' }}>
                      {new Date(brand.createdAt).toLocaleDateString()}
                    </td>
                    <td style={styles.td}>
                      <Link href={`/admin/collections/brands/${brand.id}`} style={styles.actionLink}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div style={styles.section}>
          <div style={styles.searchRow}>
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            <span style={styles.resultCount}>{filteredUsers.length} users</span>
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Brand</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Subscription</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Joined</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const subBadge = getSubscriptionBadge(user.subscription)
                  return (
                    <tr key={user.id} style={styles.tr}>
                      <td style={styles.td}>{user.email}</td>
                      <td style={styles.td}>{user.brandName}</td>
                      <td style={{ ...styles.td, textTransform: 'capitalize' }}>{user.role}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, background: subBadge.bg }}>
                          {subBadge.text}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          background: user.isVerified ? '#22c55e' : '#f59e0b',
                        }}>
                          {user.isVerified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, color: '#71717a' }}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td style={styles.td}>
                        <Link href={`/admin/collections/brand-users/${user.id}`} style={styles.actionLink}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#71717a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 700,
    color: '#fff',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#71717a',
  },
  newButton: {
    padding: '10px 20px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    borderBottom: '1px solid #27272a',
  },
  tab: {
    padding: '12px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '-1px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    marginBottom: '32px',
  },
  statCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '13px',
    color: '#71717a',
    marginTop: '4px',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    margin: '0 0 16px',
    fontSize: '18px',
    fontWeight: 600,
    color: '#e4e4e7',
  },
  topBrandsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  topBrandCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    padding: '16px',
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  topBrandName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e4e4e7',
  },
  topBrandScore: {
    fontSize: '24px',
    fontWeight: 700,
  },
  topBrandProducts: {
    fontSize: '12px',
    color: '#71717a',
  },
  searchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  searchInput: {
    padding: '10px 16px',
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    width: '300px',
  },
  resultCount: {
    fontSize: '13px',
    color: '#71717a',
  },
  tableContainer: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#71717a',
    background: '#27272a',
    borderBottom: '1px solid #3f3f46',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid #27272a',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#e4e4e7',
  },
  brandCell: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandName: {
    fontWeight: 600,
    color: '#fff',
  },
  brandSlug: {
    fontSize: '12px',
    color: '#71717a',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
  },
  actionLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '13px',
  },
}

export default BrandManagementDashboard

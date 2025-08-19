# Webapp Connection Architecture

## Overview
This document describes how the Next.js webapp deployed on Vercel will connect to and interact with the node-monitor service running on the Raspberry Pi.

## Architecture Pattern

### Data Access Layer (DAL) Structure
```
webapp/
├── lib/
│   ├── dal/
│   │   ├── monitor-client.ts     # HTTP client for Pi communication
│   │   ├── system-queries.ts     # System data queries
│   │   ├── docker-queries.ts     # Docker data queries
│   │   └── websocket-client.ts   # Real-time data connection
│   ├── types/
│   │   ├── system.ts            # System monitoring types
│   │   └── docker.ts            # Docker container types
│   └── config/
│       └── monitor.ts           # Connection configuration
├── app/
│   ├── actions/
│   │   ├── system-actions.ts    # Server actions for system data
│   │   └── docker-actions.ts    # Server actions for Docker data
│   └── dashboard/
│       └── page.tsx             # Main dashboard page
```

## Connection Configuration

### Environment Variables
```typescript
// .env.local (Vercel)
MONITOR_API_URL=https://your-pi-domain.com:3001
MONITOR_API_KEY=your-secure-api-key
MONITOR_WEBSOCKET_URL=wss://your-pi-domain.com:3001
```

### Client Configuration
```typescript
// lib/config/monitor.ts
export const monitorConfig = {
  apiUrl: process.env.MONITOR_API_URL!,
  apiKey: process.env.MONITOR_API_KEY!,
  wsUrl: process.env.MONITOR_WEBSOCKET_URL!,
  timeout: 10000,
  retryAttempts: 3,
}
```

## Data Access Layer Implementation

### HTTP Client
```typescript
// lib/dal/monitor-client.ts
import { monitorConfig } from '@/lib/config/monitor'

class MonitorClient {
  private baseURL: string
  private apiKey: string

  constructor() {
    this.baseURL = monitorConfig.apiUrl
    this.apiKey = monitorConfig.apiKey
  }

  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 30 }, // Cache for 30 seconds
    })

    if (!response.ok) {
      throw new Error(`Monitor API error: ${response.statusText}`)
    }

    return response.json()
  }

  async getSystemOverview() {
    return this.request('/api/system/overview')
  }

  async getDockerContainers() {
    return this.request('/api/docker/containers')
  }

  // Additional methods...
}

export const monitorClient = new MonitorClient()
```

### System Data Queries
```typescript
// lib/dal/system-queries.ts
import { monitorClient } from './monitor-client'
import { SystemOverview, CpuStats, MemoryStats } from '@/lib/types/system'

export async function getSystemOverview(): Promise<SystemOverview> {
  try {
    return await monitorClient.getSystemOverview()
  } catch (error) {
    console.error('Failed to fetch system overview:', error)
    throw new Error('Unable to connect to monitoring service')
  }
}

export async function getCpuStats(): Promise<CpuStats> {
  return monitorClient.getCpuStats()
}

export async function getMemoryStats(): Promise<MemoryStats> {
  return monitorClient.getMemoryStats()
}
```

## Next.js Server Actions

### System Actions
```typescript
// app/actions/system-actions.ts
'use server'

import { getSystemOverview, getCpuStats, getMemoryStats } from '@/lib/dal/system-queries'
import { revalidatePath } from 'next/cache'

export async function fetchSystemData() {
  try {
    const [overview, cpu, memory] = await Promise.all([
      getSystemOverview(),
      getCpuStats(),
      getMemoryStats(),
    ])

    return {
      success: true,
      data: { overview, cpu, memory }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function refreshSystemData() {
  revalidatePath('/dashboard')
  return fetchSystemData()
}
```

### Docker Actions
```typescript
// app/actions/docker-actions.ts
'use server'

import { getDockerContainers, getContainerLogs } from '@/lib/dal/docker-queries'

export async function fetchDockerData() {
  try {
    const containers = await getDockerContainers()
    return { success: true, data: containers }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to fetch Docker data'
    }
  }
}

export async function fetchContainerLogs(containerId: string, lines: number = 100) {
  try {
    const logs = await getContainerLogs(containerId, lines)
    return { success: true, data: logs }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to fetch container logs'
    }
  }
}
```

## Real-time Data with WebSocket

### WebSocket Client
```typescript
// lib/dal/websocket-client.ts
import { monitorConfig } from '@/lib/config/monitor'

export class MonitorWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  connect(onMessage: (data: any) => void) {
    try {
      this.ws = new WebSocket(`${monitorConfig.wsUrl}/ws/metrics`)
      
      this.ws.onopen = () => {
        console.log('Connected to monitor WebSocket')
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        onMessage(data)
      }

      this.ws.onclose = () => {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++
            this.connect(onMessage)
          }, 2000 * this.reconnectAttempts)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
```

## Dashboard Implementation

### Main Dashboard Page
```typescript
// app/dashboard/page.tsx
import { SystemOverview } from '@/components/SystemOverview'
import { DockerContainers } from '@/components/DockerContainers'
import { fetchSystemData, fetchDockerData } from '@/app/actions/system-actions'

export default async function DashboardPage() {
  const [systemResult, dockerResult] = await Promise.all([
    fetchSystemData(),
    fetchDockerData(),
  ])

  return (
    <div className="dashboard">
      <h1>Raspberry Pi Monitor</h1>
      
      {systemResult.success ? (
        <SystemOverview data={systemResult.data} />
      ) : (
        <div className="error">Failed to load system data: {systemResult.error}</div>
      )}

      {dockerResult.success ? (
        <DockerContainers data={dockerResult.data} />
      ) : (
        <div className="error">Failed to load Docker data: {dockerResult.error}</div>
      )}
    </div>
  )
}
```

## Error Handling & Fallbacks

### Connection Resilience
- Automatic retry logic for failed API calls
- WebSocket reconnection with exponential backoff
- Graceful degradation when Pi is offline
- Cached data serving during network issues

### User Experience
- Loading states for all data fetching
- Error boundaries for component-level failures
- Offline indicators when connection is lost
- Manual refresh capabilities

## Security Considerations

### API Authentication
- Bearer token authentication for all API calls
- Token rotation capability
- CORS configuration for Vercel domain

### Network Security
- HTTPS/WSS only connections
- Rate limiting on Pi endpoints
- Input validation on all server actions

This architecture provides a robust, type-safe connection between your Vercel webapp and Raspberry Pi monitoring service using Next.js best practices.
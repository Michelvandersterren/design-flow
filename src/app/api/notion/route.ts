import { NextRequest, NextResponse } from 'next/server'
import { notion, NOTION_DATABASE, parseNotionDesign } from '@/lib/notion'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, designCode } = body

    switch (action) {
      case 'sync_all':
        return await syncAllDesigns()
      case 'sync_single':
        if (!designCode) {
          return NextResponse.json({ error: 'designCode is required for sync_single' }, { status: 400 })
        }
        return await syncSingleDesign(designCode)
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Notion sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

// Bepaal welke status te gebruiken bij een sync-update.
// Notion is leidend voor LIVE, maar overschrijft nooit lokale voortgang
// (REVIEW, APPROVED, LIVE blijven staan tenzij Notion zegt LIVE).
function resolveStatus(notionLiveStatus: string, existingStatus: string | null): string {
  if (notionLiveStatus === 'LIVE') return 'LIVE'
  // Bewaar lokale voortgang — niet terugzetten naar DRAFT
  if (existingStatus && ['REVIEW', 'APPROVED', 'LIVE'].includes(existingStatus)) {
    return existingStatus
  }
  return 'DRAFT'
}

async function syncAllDesigns() {
  let allPages: any[] = []
  let cursor: string | undefined
  
  do {
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE,
      page_size: 100,
      start_cursor: cursor,
    })
    
    allPages = [...allPages, ...response.results]
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
    
  } while (cursor)
  
  let synced = 0
  let created = 0
  let updated = 0
  let errors = 0
  
  for (const page of allPages) {
    const design = parseNotionDesign(page)
    
    if (!design.designCode) continue
    
    try {
      const existingByNotion = await prisma.design.findFirst({
        where: { 
          OR: [
            { notionId: design.id },
            { designCode: design.designCode }
          ]
        }
      })

      const baseData = {
        designName: design.designName,
        designType: design.designType,
        styleFamily: design.styleFamily,
        collections: JSON.stringify(design.collections),
        colorTags: JSON.stringify(design.colorTags),
        inductionFriendly: design.inductionFriendly,
        circleFriendly: design.circleFriendly,
        splashFriendly: design.splashFriendly,
        notionData: JSON.stringify(design),
        status: resolveStatus(design.liveStatus, existingByNotion?.status ?? null),
      }

      if (existingByNotion) {
        await prisma.design.update({
          where: { id: existingByNotion.id },
          data: {
            ...baseData,
            notionId: design.id,
          }
        })
        updated++
      } else {
        await prisma.design.create({
          data: {
            notionId: design.id,
            designCode: design.designCode,
            ...baseData,
          }
        })
        created++
      }
      synced++
    } catch (error: any) {
      console.error(`Error syncing design ${design.designCode}:`, error.message)
      errors++
    }
  }
  
  await prisma.syncLog.create({
    data: {
      source: 'notion',
      action: 'sync_all',
      entity: 'design',
      entityId: 'all',
      status: 'completed',
      details: JSON.stringify({ synced, created, updated }),
    }
  })
  
  return NextResponse.json({
    success: true,
    synced,
    created,
    updated,
    errors,
  })
}

async function syncSingleDesign(designCode: string) {
  const response = await notion.databases.query({
    database_id: NOTION_DATABASE,
    filter: {
      property: 'Design Code',
      rich_text: { equals: designCode }
    }
  })
  
  if (response.results.length === 0) {
    return NextResponse.json({ error: 'Design not found in Notion' }, { status: 404 })
  }
  
  const design = parseNotionDesign(response.results[0])
  
  const existing = await prisma.design.findFirst({
    where: { 
      OR: [
        { notionId: design.id },
        { designCode: design.designCode }
      ]
    }
  })
  
  if (existing) {
    const updated = await prisma.design.update({
      where: { id: existing.id },
      data: {
        designName: design.designName,
        designType: design.designType,
        styleFamily: design.styleFamily,
        collections: JSON.stringify(design.collections),
        colorTags: JSON.stringify(design.colorTags),
        inductionFriendly: design.inductionFriendly,
        circleFriendly: design.circleFriendly,
        splashFriendly: design.splashFriendly,
        notionData: JSON.stringify(design),
        notionId: design.id,
        status: resolveStatus(design.liveStatus, existing.status),
      }
    })
    
    return NextResponse.json({ success: true, design: updated })
  } else {
    const created = await prisma.design.create({
      data: {
        notionId: design.id,
        designCode: design.designCode,
        designName: design.designName,
        designType: design.designType,
        styleFamily: design.styleFamily,
        collections: JSON.stringify(design.collections),
        colorTags: JSON.stringify(design.colorTags),
        inductionFriendly: design.inductionFriendly,
        circleFriendly: design.circleFriendly,
        splashFriendly: design.splashFriendly,
        notionData: JSON.stringify(design),
        status: resolveStatus(design.liveStatus, null),
      }
    })
    
    return NextResponse.json({ success: true, design: created })
  }
}

export async function GET() {
  try {
    const designs = await prisma.design.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        variants: true,
        content: true,
        workflowSteps: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    
    return NextResponse.json({ designs })
  } catch (error) {
    console.error('Error fetching designs:', error)
    return NextResponse.json({ error: 'Failed to fetch designs' }, { status: 500 })
  }
}

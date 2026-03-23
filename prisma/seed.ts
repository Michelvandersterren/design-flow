import { PrismaClient } from '@prisma/client'
import { Client } from '@notionhq/client'

const prisma = new PrismaClient()

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

const NOTION_DATABASE = process.env.NOTION_DATABASE_ID!

interface NotionDesignProperties {
  id: string
  designCode: string
  designName: string
  designType: string | null
  styleFamily: string | null
  collections: string[]
  colorTags: string[]
  liveStatus: 'LIVE' | 'DRAFT' | 'NOT_ONLINE'
  inductionFriendly: boolean
  circleFriendly: boolean
  splashFriendly: boolean
  masterFileLink: string | null
}

function parseNotionDesign(page: any): NotionDesignProperties {
  const props = page.properties
  
  const getTitle = (prop: any) => prop?.title?.[0]?.plain_text || null
  const getRichText = (prop: any) => prop?.rich_text?.[0]?.plain_text || null
  const getSelect = (prop: any) => prop?.select?.name || null
  const getMultiSelect = (prop: any) => prop?.multi_select?.map((s: any) => s.name) || []
  const getCheckbox = (prop: any) => prop?.checkbox || false
  const getUrl = (prop: any) => prop?.url || null
  const getStatus = (prop: any) => {
    const status = prop?.status?.name
    if (status === 'LIVE') return 'LIVE'
    if (status === 'Draft') return 'DRAFT'
    return 'NOT_ONLINE'
  }
  
  return {
    id: page.id,
    designCode: getRichText(props['Design Code']) || '',
    designName: getTitle(props['Design Name']) || '',
    designType: getSelect(props['Design Type']),
    styleFamily: getSelect(props['Style Family']),
    collections: getMultiSelect(props['Collection']),
    colorTags: getMultiSelect(props['Color Tags']),
    liveStatus: getStatus(props['Live on KitchenArt NL?']),
    inductionFriendly: getCheckbox(props['Induction-friendly']),
    circleFriendly: getCheckbox(props['Circle-friendly']),
    splashFriendly: getCheckbox(props['Splash-friendly']),
    masterFileLink: getUrl(props['Master File Link']),
  }
}

async function main() {
  console.log('Starting Notion sync...')
  
  const response = await notion.databases.query({
    database_id: NOTION_DATABASE,
    page_size: 100,
  })
  
  console.log(`Found ${response.results.length} designs in Notion`)
  
  let created = 0
  let updated = 0
  
  for (const page of response.results) {
    const design = parseNotionDesign(page)
    
    if (!design.designCode) {
      console.log(`Skipping ${design.designName} - no design code`)
      continue
    }
    
    const existing = await prisma.design.findUnique({
      where: { notionId: design.id }
    })
    
    if (existing) {
      await prisma.design.update({
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
          status: design.liveStatus === 'LIVE' ? 'LIVE' : 'DRAFT',
        }
      })
      updated++
    } else {
      await prisma.design.create({
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
          status: design.liveStatus === 'LIVE' ? 'LIVE' : 'DRAFT',
        }
      })
      created++
    }
  }
  
  console.log(`Sync completed: ${created} created, ${updated} updated`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

import { Client } from '@notionhq/client'
import { NOTION_TOKEN, NOTION_DATABASE_ID } from './env'

if (!NOTION_TOKEN) {
  throw new Error('NOTION_TOKEN is not set')
}

export const notion = new Client({
  auth: NOTION_TOKEN,
})

export const NOTION_DATABASE = NOTION_DATABASE_ID!

export interface NotionDesignProperties {
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

export function parseNotionDesign(page: any): NotionDesignProperties {
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

/**
 * Zet het "Live on KitchenArt NL?" status-veld op LIVE voor een Notion pagina.
 * Schrijft optioneel ook de Shopify product URL terug naar Notion.
 * Gebruik na succesvolle Shopify publicatie.
 */
export async function markDesignLiveInNotion(
  notionPageId: string,
  shopifyHandle?: string
): Promise<void> {
  const properties: Record<string, unknown> = {
    'Live on KitchenArt NL?': {
      status: { name: 'LIVE' },
    },
  }

  if (shopifyHandle) {
    const shopifyUrl = `https://www.kitchenart.nl/products/${shopifyHandle}`
    properties['Shopify URL'] = { url: shopifyUrl }
  }

  await notion.pages.update({
    page_id: notionPageId,
    properties,
  } as any)
}

/**
 * Schrijft een stijlfamilie terug naar het "Style Family" select-veld in Notion.
 * Gebruik na automatische groepering via Claude.
 */
export async function updateStyleFamilyInNotion(
  notionPageId: string,
  styleFamily: string
): Promise<void> {
  await notion.pages.update({
    page_id: notionPageId,
    properties: {
      'Style Family': {
        select: { name: styleFamily },
      },
    },
  } as any)
}

/**
 * Zet het "Live on KitchenArt NL?" status-veld op "Not Online".
 */
export async function markDesignOfflineInNotion(notionPageId: string): Promise<void> {
  await notion.pages.update({
    page_id: notionPageId,
    properties: {
      'Live on KitchenArt NL?': {
        status: { name: 'Not Online' },
      },
    },
  } as any)
}

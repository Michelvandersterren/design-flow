import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_BRAND_VOICE = {
  key: 'main',
  companyInfo:
    'KitchenArt is een Nederlandse webshop die hoogwaardige keukenproducten verkoopt met unieke, stijlvolle ontwerpen. KitchenArt is onderdeel van ModernArt. Vestigingsadres: De Nieuwe Erven 3, 5431 NV Cuijk.',
  mission:
    'KitchenArt maakt van elke keuken een stijlvolle ruimte met functionele producten en unieke designs. Geen dertien-in-een-dozijn, maar zorgvuldig geselecteerde ontwerpen die passen bij moderne en klassieke interieurs.',
  targetAudience:
    'Huishoudens die hun keuken willen verfraaien. Zowel kleine stadskeukens als grote woonkeukens. Klanten waarderen kwaliteit, uniekheid en een mooi interieur. Leeftijd 25-55, woont zelfstandig of met gezin, geïnteresseerd in interieurdesign.',
  partnerInfo:
    'KitchenArt produceert op bestelling via Probo, een professionele drukpartner. Probo levert exclusief aan printprofessionals. Alle producten worden geprint op professionele apparatuur (o.a. Durst P5 210). Levering binnen 1-3 werkdagen na bestelling.',
  materialIB:
    'Hoogwaardig vinyl, 2mm dik. Anti-slip achterkant. Oprolbaar en gemakkelijk op te bergen. Waterafstotend. Niet vaatwasmachinebestendig — reinigen met een vochtig doekje. Brandvertragend (B1-gecertificeerd). Levensduur circa 5 jaar bij normaal gebruik.',
  materialMC:
    'Verkrijgbaar in: Dibond Budget (aluminium composiet), Dibond Premium (hogere kleurdiepte), Dibond Butler Finish (geborsteld aluminium look), Forex (lichtgewicht PVC-schuimplaat), Multiplex 9mm (massief houten look). Alle varianten zijn geschikt voor gebruik binnenshuis. Eenvoudig te (ver)plaatsen.',
  materialSP:
    'Aluminium Dibond. Krasvast en hittebestendig. Geschikt als spatscherm achter het fornuis. Professionele afwerking, gemakkelijk schoon te maken.',
  toneOfVoice:
    'Warm, toegankelijk en zelfverzekerd. Combineert functionaliteit met lifestyle en interieurdesign. Spreekt de klant aan als iemand die smaak heeft en van kwaliteit houdt. Niet te technisch, wel informatief. Korte, krachtige zinnen afgewisseld met sfeervolle beschrijvingen.',
  doUse:
    'stijlvol, premium, uniek, eyecatcher, dagelijks gebruik, sfeer, interieur, keuken, bescherming, design, exclusief, duurzaam, kwaliteit, verfraai, opvallend, persoonlijk, bijzonder, tijdloos',

  // ── Taalspecifiek: verboden woorden ──
  doNotUse_nl: 'goedkoop, budgetvriendelijk, simpel, standaard, gewoon, basic, normaal, doorsnee, kleurrijk (te algemeen), mooi (te vaag zonder context)',
  doNotUse_de: '',
  doNotUse_en: '',
  doNotUse_fr: '',

  // ── Taalspecifiek: SEO keywords ──
  seoKeywordsIB_nl: 'inductiebeschermer, inductie beschermer, kookplaat beschermer, inductie mat, inductieplaat beschermer, anti-slip kookplaat mat, vinyl inductiebeschermer, design inductiebeschermer',
  seoKeywordsIB_de: '',
  seoKeywordsIB_en: '',
  seoKeywordsIB_fr: '',
  seoKeywordsMC_nl: 'muurcirkel, wandcirkel, ronde wanddecoratie, muur decoratie keuken, keuken wanddecoratie, muurcirkel keuken, dibond muurcirkel, aluminium wanddecoratie',
  seoKeywordsMC_de: '',
  seoKeywordsMC_en: '',
  seoKeywordsMC_fr: '',
  seoKeywordsSP_nl: 'spatscherm keuken, aluminium spatscherm, keuken spatscherm, achterwand keuken, kookplaat achterwand, design spatscherm, dibond spatscherm',
  seoKeywordsSP_de: '',
  seoKeywordsSP_en: '',
  seoKeywordsSP_fr: '',

  // ── Taalspecifiek: voorbeeldteksten ──
  exampleDescriptionIB_nl:
    'Geef je keuken een unieke uitstraling met deze stijlvolle inductiebeschermer van KitchenArt. Het [design naam]-design geeft je kookplaat direct een persoonlijk karakter — functioneel én decoratief.\n\nGemaakt van hoogwaardig vinyl (2mm dik) met een anti-slip achterkant, zodat de mat stevig op zijn plek blijft tijdens het koken. Dankzij het waterafstotende materiaal is hij eenvoudig schoon te houden met een vochtig doekje.\n\nBeschikbaar in diverse maten om perfect aan te sluiten op jouw inductieplaat.',
  exampleDescriptionIB_de: '',
  exampleDescriptionIB_en: '',
  exampleDescriptionIB_fr: '',
  exampleDescriptionMC_nl:
    'Maak van je keuken een echte eyecatcher met deze opvallende muurcirkel van KitchenArt. Het [design naam]-ontwerp brengt sfeer en karakter in elke ruimte — van moderne open keukens tot gezellige landelijke interieurs.\n\nDe muurcirkel is verkrijgbaar in verschillende materialen, zoals Dibond Premium voor optimale kleurdiepte of het elegante Dibond Butler Finish met geborsteld aluminium look. Eenvoudig op te hangen en te verplaatsen.\n\nGeprint op bestelling voor de scherpste kleuren en langdurige kwaliteit.',
  exampleDescriptionMC_de: '',
  exampleDescriptionMC_en: '',
  exampleDescriptionMC_fr: '',
  exampleDescriptionSP_nl:
    'Combineer bescherming en stijl met dit premium spatscherm van KitchenArt. Het [design naam]-design geeft je keuken een exclusieve uitstraling terwijl je kookwand optimaal beschermd blijft tegen spatten en vuil.\n\nGemaakt van stevig aluminium Dibond: krasvast, hittebestendig en gemakkelijk schoon te maken. Het spatscherm wordt op maat geprint voor de mooiste kleurweergave.\n\nEen unieke toevoeging aan elke keuken.',
  exampleDescriptionSP_de: '',
  exampleDescriptionSP_en: '',
  exampleDescriptionSP_fr: '',

  faq: JSON.stringify([
    { q: 'Is de inductiebeschermer vaatwasmachinebestendig?', a: 'Nee, de inductiebeschermer mag niet in de vaatwasser. Reinig hem met een vochtig doekje.' },
    { q: 'Hoe lang gaat een inductiebeschermer mee?', a: 'Bij normaal gebruik heeft een inductiebeschermer een levensduur van circa 5 jaar.' },
    { q: 'Kan ik een muurcirkel ook in de badkamer gebruiken?', a: 'De muurcirkels zijn bedoeld voor gebruik binnenshuis. Voor vochtige ruimtes als badkamers is Dibond geschikter dan Forex.' },
    { q: 'Wordt er op bestelling geproduceerd?', a: 'Ja, alle producten worden op bestelling geproduceerd. Levering duurt 1-3 werkdagen.' },
    { q: 'Kan ik een eigen design aanvragen?', a: 'Neem contact op via service@kitchenart.nl om de mogelijkheden te bespreken.' },
  ]),
}

export async function GET() {
  try {
    let brandVoice = await prisma.brandVoice.findUnique({ where: { key: 'main' } })

    if (!brandVoice) {
      brandVoice = await prisma.brandVoice.create({ data: DEFAULT_BRAND_VOICE })
    }

    return NextResponse.json({ brandVoice })
  } catch (error) {
    console.error('BrandVoice GET error:', error)
    return NextResponse.json({ error: 'Failed to load brand voice' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()

    // Remove key from body if present — we always update 'main'
    const { key: _key, ...data } = body

    const brandVoice = await prisma.brandVoice.upsert({
      where: { key: 'main' },
      update: data,
      create: { key: 'main', ...data },
    })

    return NextResponse.json({ brandVoice })
  } catch (error) {
    console.error('BrandVoice PUT error:', error)
    return NextResponse.json({ error: 'Failed to save brand voice' }, { status: 500 })
  }
}

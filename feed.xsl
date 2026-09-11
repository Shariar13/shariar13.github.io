<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="/rss/channel/title"/> (RSS feed)</title>
        <style>
          body{margin:0;background:#f6f7fa;color:#0e1320;font:16px/1.6 Inter,system-ui,sans-serif}
          .wrap{max-width:760px;margin:0 auto;padding:48px 20px}
          .note{background:#e9f0ff;border:1px solid #cddcff;border-radius:10px;padding:14px 16px;font-size:14px;color:#1f4fc4;margin-bottom:28px}
          h1{font-size:1.6rem;margin:0 0 6px}
          .desc{color:#444c5e;margin:0 0 28px}
          .item{padding:16px 0;border-top:1px solid #e3e7ee}
          .item a{font-weight:600;color:#1f4fc4;text-decoration:none;font-size:1.05rem}
          .item a:hover{text-decoration:underline}
          .meta{font-family:ui-monospace,monospace;font-size:12px;color:#6d7588;margin:4px 0 6px}
          .item p{margin:0;color:#444c5e;font-size:.95rem}
          code{background:#eef1f6;padding:2px 6px;border-radius:4px;font-size:.9em}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="note">This is an RSS feed. Copy the address <code><xsl:value-of select="/rss/channel/atom:link/@href"/></code> into a feed reader (Feedly, NetNewsWire, Inoreader) to subscribe.</div>
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <p class="desc"><xsl:value-of select="/rss/channel/description"/> · <a href="{/rss/channel/link}">Visit the site</a></p>
          <xsl:for-each select="/rss/channel/item">
            <div class="item">
              <a href="{link}"><xsl:value-of select="title"/></a>
              <div class="meta"><xsl:value-of select="substring(pubDate, 1, 16)"/></div>
              <p><xsl:value-of select="description"/></p>
            </div>
          </xsl:for-each>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>

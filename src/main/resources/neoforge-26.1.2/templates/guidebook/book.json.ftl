<#-- @formatter:off -->
<#macro colorProp propName colorVal defaultVal>
  <#if colorVal?has_content>
    <#assign cleanColor = colorVal?replace("#", "")>
    <#if cleanColor?lower_case != defaultVal?lower_case>
      , "${propName}": "${cleanColor}"
    </#if>
  </#if>
</#macro>
<#macro stringProp propName val>
  <#if val?has_content>
    , "${propName}": "${val?json_string}"
  </#if>
</#macro>
{
  "name": "${data.bookName?has_content?then(data.bookName, registryname)?json_string}",
  "landing_text": "${data.landingText?has_content?then(data.landingText, " ")?json_string}",
  "use_resource_pack": true
  <#if data.version?has_content && data.version != "0">
    <#assign verTrim = data.version?trim>
    <#if verTrim?matches("^-?\\d+$")>,
      "version": ${verTrim}
    <#else>,
      "version": "${verTrim?json_string}"
    </#if>
  </#if>
  <@stringProp "subtitle" data.subtitle />
  <#if data.getMappedCreativeTab()?has_content>,
    "creative_tab": "${data.getMappedCreativeTab()}"
  </#if>
  <#if data.hasCustomBookModel()>
    <@stringProp "model" modid + ":" + registryname />
  <#else>
    <@stringProp "model" data.getDefaultBookModel() />
  </#if>
  <@stringProp "book_texture" data.bookTexture />
  <@stringProp "filler_texture" data.fillerTexture />
  <@stringProp "crafting_texture" data.craftingTexture />
  <#if data.openSound?has_content>
    <@stringProp "open_sound" generator.map(data.openSound, "sounds")?replace("CUSTOM:", modid + ":") />
  </#if>
  <#if data.flipSound?has_content>
    <@stringProp "flip_sound" generator.map(data.flipSound, "sounds")?replace("CUSTOM:", modid + ":") />
  </#if>
  <@stringProp "index_icon" data.indexIcon />
  <#if data.advancementsTab?has_content>
    <@stringProp "advancements_tab" generator.map(data.advancementsTab, "achievements") />
  </#if>
  <#if !data.showProgress>,
    "show_progress": false
  </#if>
  <#if !data.showToasts>,
    "show_toasts": false
  </#if>
  <#if data.pamphlet>,
    "pamphlet": true
  </#if>
  <#if data.useBlockyFont>,
    "use_blocky_font": true
  </#if>
  <#if data.pauseGame>,
    "pause_game": true
  </#if>
  <#if data.textOverflowMode?has_content && data.textOverflowMode != "overflow">,
    "text_overflow_mode": "${data.textOverflowMode}"
  </#if>
  <@colorProp "text_color" data.textColor "000000" />
  <@colorProp "header_color" data.headerColor "333333" />
  <@colorProp "nameplate_color" data.nameplateColor "FFDD00" />
  <@colorProp "link_color" data.linkColor "0000EE" />
  <@colorProp "link_hover_color" data.linkHoverColor "8800EE" />
  <@colorProp "progress_bar_color" data.progressBarColor "FFFF55" />
  <@colorProp "progress_bar_background" data.progressBarBackground "DDDDDD" />
}
<#-- @formatter:on -->
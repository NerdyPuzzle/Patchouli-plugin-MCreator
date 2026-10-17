<#-- @formatter:off -->
<#macro renderMultiblock mb>
{
  <#assign hasMbProp = false>
  <#if mb.mapping?? && !mb.mapping.isEmpty()>
    "mapping": {
      <#list mb.mapping.keySet() as k>
        "${k}": "${mb.mapping.get(k)?json_string}"<#sep>,
      </#list>
    }
    <#assign hasMbProp = true>
  </#if>
  <#if mb.pattern?has_content>
    <#if hasMbProp>,</#if>
    "pattern": [
      <#list mb.pattern as layer>
        [
          <#list layer as row>
            "${row}"<#sep>,
          </#list>
        ]<#sep>,
      </#list>
    ]
    <#assign hasMbProp = true>
  </#if>
  <#if mb.symmetrical>
    <#if hasMbProp>,</#if>
    "symmetrical": true
    <#assign hasMbProp = true>
  </#if>
  <#if mb.offset?has_content && mb.offset?size == 3>
    <#if hasMbProp>,</#if>
    "offset": [
      <#list mb.offset as off>
        ${off}<#sep>,
      </#list>
    ]
  </#if>
}
</#macro>

<#macro renderPage page>
<#assign rawType = page.type?has_content?then(page.type, "patchouli:text")>
<#assign shortType = rawType?starts_with("patchouli:")?then(rawType?substring(10), rawType)>
{
  "type": "${rawType}"<#if page.advancement?has_content>,
  "advancement": "${generator.map(page.advancement, "achievements")}"</#if><#switch shortType>
  <#case "text">
    <#if page.title?has_content>,
    "title": "${page.title?json_string}"</#if>,
    "text": "${(page.text!"")?json_string}"
    <#break>
  <#case "image">
    <#if page.title?has_content>,
    "title": "${page.title?json_string}"</#if>,
    "images": [
      <#if page.images?has_content>
        <#assign firstImg = true>
        <#list page.images as img>
          <#if img?has_content>
            <#if !firstImg>,</#if>"${img?json_string}"
            <#assign firstImg = false>
          </#if>
        </#list>
      </#if>
    ]<#if page.border>,
    "border": true</#if><#if page.text?has_content>,
    "text": "${page.text?json_string}"</#if>
    <#break>
  <#case "crafting">
  <#case "smelting">
    <#if page.recipe?has_content>,
    "recipe": "${page.recipe?json_string}"</#if><#if page.recipe2?has_content>,
    "recipe2": "${page.recipe2?json_string}"</#if><#if page.title?has_content>,
    "title": "${page.title?json_string}"</#if><#if page.text?has_content>,
    "text": "${page.text?json_string}"</#if>
    <#break>
  <#case "multiblock">,
    "name": "${page.name?has_content?then(page.name, "Multiblock")?json_string}"<#if page.multiblock??>,
    "multiblock": <@renderMultiblock page.multiblock /></#if><#if !page.enableVisualize>,
    "enable_visualize": false</#if><#if page.text?has_content>,
    "text": "${page.text?json_string}"</#if>
    <#break>
  <#case "entity">,
    "entity": "${page.entity?has_content?then(page.entity, "minecraft:pig")?json_string}"<#if page.scale != 1.0>,
    "scale": ${page.scale}</#if><#if page.offset != 0.0>,
    "offset": ${page.offset}</#if><#if !page.rotate>,
    "rotate": false</#if><#if page.defaultRotation != -45.0>,
    "default_rotation": ${page.defaultRotation}</#if><#if page.name?has_content>,
    "name": "${page.name?json_string}"</#if><#if page.text?has_content>,
    "text": "${page.text?json_string}"</#if>
    <#break>
  <#case "spotlight">,
    "item": "${page.item?has_content?then(page.item, "minecraft:book")?json_string}"<#if page.title?has_content>,
    "title": "${page.title?json_string}"</#if><#if page.linkRecipe>,
    "link_recipe": true</#if><#if page.text?has_content>,
    "text": "${page.text?json_string}"</#if>
    <#break>
  <#case "link">,
    "url": "${page.url?has_content?then(page.url, "https://mcreator.net")?json_string}",
    "link_text": "${page.linkText?has_content?then(page.linkText, "Click Here")?json_string}"<#if page.title?has_content>,
    "title": "${page.title?json_string}"</#if><#if page.text?has_content>,
    "text": "${page.text?json_string}"</#if>
    <#break>
  <#case "relations">,
    "entries": [
      <#if page.entries?has_content>
        <#assign firstEntry = true>
        <#list page.entries as entryRef>
          <#if entryRef?has_content>
            <#if !firstEntry>,</#if>"${entryRef}"
            <#assign firstEntry = false>
          </#if>
        </#list>
      </#if>
    ]<#if page.title?has_content>,
    "title": "${page.title?json_string}"</#if><#if page.text?has_content>,
    "text": "${page.text?json_string}"</#if>
    <#break>
  <#case "quest">
    <#if page.trigger?has_content>,
    "trigger": "${generator.map(page.trigger, "achievements")}"</#if><#if page.title?has_content>,
    "title": "${page.title?json_string}"</#if><#if page.text?has_content>,
    "text": "${page.text?json_string}"</#if>
    <#break>
  <#case "empty">
    <#if !page.drawFiller>,
    "draw_filler": false</#if>
    <#break>
  <#default>
</#switch>
}
</#macro>

{
  "name": "${data.name?has_content?then(data.name, data.id)?json_string}",
  "category": "${data.category?has_content?then((data.category?contains(":")?then(data.category, modid + ":" + data.category)), modid + ":default")}",
  "icon": "${data.icon?has_content?then(data.icon, "minecraft:book")?json_string}",
  "pages": [
    <#if data.pages?has_content>
      <#list data.pages as page>
        <@renderPage page /><#sep>,
      </#list>
    <#else>
      {
        "type": "patchouli:text",
        "text": "No content defined yet."
      }
    </#if>
  ]<#if data.advancement?has_content>,
  "advancement": "${generator.map(data.advancement, "achievements")}"</#if><#if data.priority>,
  "priority": true</#if><#if data.secret>,
  "secret": true</#if><#if data.readByDefault>,
  "read_by_default": true</#if><#if data.sortnum != 0>,
  "sortnum": ${data.sortnum}</#if><#if data.turnin?has_content>,
  "turnin": "${generator.map(data.turnin, "achievements")}"</#if><#if data.entryColor?has_content>,
  "entry_color": "${data.entryColor?replace("#", "")}"</#if>
}
<#-- @formatter:on -->
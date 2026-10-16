<#-- @formatter:off -->
{
  "name": "${data.name?has_content?then(data.name, data.id)?json_string}",
  "description": "${(data.description!"")?json_string}",
  "icon": "${data.icon?has_content?then(data.icon, "minecraft:book")?json_string}"<#if data.parent?has_content>,
  "parent": "${data.parent?contains(":")?then(data.parent, modid + ":" + data.parent)}"</#if><#if data.sortnum != 0>,
  "sortnum": ${data.sortnum}</#if><#if data.secret>,
  "secret": true</#if>
}
<#-- @formatter:on -->
<#if data.hasItemTextureModel()>
{
  "parent": "minecraft:item/generated",
  "textures": {
    "layer0": "${data.getItemTextureLocation()}"
  }
}
<#else>
{
  "parent": "${modid}:custom/${data.customModelName.split(":")[0]}",
  "textures": {
    <#list data.getTextureMap().entrySet() as texture>
      "${texture.getKey()}": "${texture.getValue().format("%s:block/%s")}"<#sep>,
    </#list>
  }
}
</#if>
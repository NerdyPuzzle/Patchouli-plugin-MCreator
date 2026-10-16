<#-- @formatter:off -->
{
  "conditions": [
    {
      "type": "forge:mod_loaded",
      "modid": "patchouli"
    }
  ],
  <#if data.recipeType?lower_case == "shapeless">
    "type": "minecraft:crafting_shapeless",
  <#else>
    "type": "minecraft:crafting_shaped",
  </#if>
  "category": "misc",
  <#if data.recipeType?lower_case == "shapeless">
    "ingredients": [
      <#assign validIngredients = data.getValidRecipeIngredients()>
      <#if validIngredients?has_content>
        <#list validIngredients as element>
          <#if element?starts_with("#")>
            {
              "tag": "${element[1..]?json_string}"
            }<#sep>,
          <#else>
            {
              "item": "${element?json_string}"
            }<#sep>,
          </#if>
        </#list>
      <#else>
        {
          "item": "minecraft:book"
        }
      </#if>
    ],
  <#else>
    <#assign recipeArray = data.getOptimisedRecipe()>
    <#assign patternKeys = data.getPatternKeys()>
    "pattern": [
    <#list recipeArray as rl>
        "<#list rl as re><#if re?has_content>${patternKeys.get(re)}<#else> </#if></#list>"<#sep>,
    </#list>
    ],
    "key": {
    <#list patternKeys.keySet() as item>
        "${patternKeys.get(item)}": <#if item?starts_with("#")>{"tag": "${item[1..]?json_string}"}<#else>{"item": "${item?json_string}"}</#if><#sep>,
    </#list>
    },
  </#if>
  "result": {
    "item": "patchouli:guide_book",
    "count": 1,
    "nbt": {
      "patchouli:book": "${modid}:${registryname}"
    }
  }
}
<#-- @formatter:on -->
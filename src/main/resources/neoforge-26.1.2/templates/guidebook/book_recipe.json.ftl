<#-- @formatter:off -->
{
  "neoforge:conditions": [
    {
      "type": "neoforge:mod_loaded",
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
          "${element?json_string}"<#sep>,
        </#list>
      <#else>
        "minecraft:book"
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
        "${patternKeys.get(item)}": "${item?json_string}"<#sep>,
    </#list>
    },
  </#if>
  "result": {
    "components": {
      "patchouli:book": "${modid}:${registryname}"
    },
    "count": 1,
    "id": "patchouli:guide_book"
  }
}
<#-- @formatter:on -->
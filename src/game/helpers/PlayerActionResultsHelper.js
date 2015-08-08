// Helper methods related to rewards from player actions such as scavenging and scouting
define([
    'ash',
	'game/constants/TextConstants',
	'game/constants/ItemConstants',
	'game/constants/PerkConstants',
    'game/nodes/PlayerStatsNode',
    'game/nodes/PlayerLocationNode',
    'game/nodes/player/PlayerResourcesNode',
	'game/components/sector/SectorFeaturesComponent',
	'game/components/sector/SectorStatusComponent',
	'game/components/player/ItemsComponent',
	'game/components/player/PerksComponent',
	'game/vos/ResultVO',
	'game/vos/ResourcesVO'
], function (
	Ash,
	TextConstants,
	ItemConstants,
	PerkConstants,
	PlayerStatsNode,
	PlayerLocationNode,
	PlayerResourcesNode,
	SectorFeaturesComponent,
	SectorStatusComponent,
	ItemsComponent,
	PerksComponent,
	ResultVO,
	ResourcesVO
) {
    var PlayerActionResultsHelper = Ash.Class.extend({
		
		resourcesHelper: null,
		
		playerStatsNodes: null,
		playerResourcesNodes: null,
		playerLocationNodes: null,
		
		constructor: function (engine, gameState, resourcesHelper) {
			this.engine = engine;
			this.gameState = gameState;
			this.resourcesHelper = resourcesHelper;
            this.playerStatsNodes = engine.getNodeList(PlayerStatsNode);
            this.playerResourcesNodes = engine.getNodeList(PlayerResourcesNode);
            this.playerLocationNodes = engine.getNodeList(PlayerLocationNode);
		},
		
        getScavengeRewards: function () {
			var rewards = new ResultVO();
			
			var sectorResources = this.playerLocationNodes.head.entity.get(SectorFeaturesComponent).resources;
			var itemsComponent = this.playerStatsNodes.head.entity.get(ItemsComponent);
			var playerPos = this.playerLocationNodes.head.position;
			var levelOrdinal = this.gameState.getLevelOrdinal(playerPos.level);
			var efficiency = this.getScavengeEfficiency();
			var playerVision = this.playerStatsNodes.head.vision.value;
		
			rewards.gainedResources = this.getRewardResources(1, efficiency, sectorResources);
			rewards.gainedItems = this.getRewardItems(0.0075, playerVision * 0.25, itemsComponent, levelOrdinal);
			rewards.gainedInjuries = this.getResultInjuries();
			
			return rewards;
		},
		
		getScoutRewards: function () {
			var rewards = new ResultVO();
			
			var efficiency = this.getScavengeEfficiency();
            var sectorResources = this.playerLocationNodes.head.entity.get(SectorFeaturesComponent).resources;
			
			rewards.gainedResources = this.getRewardResources(0.5, efficiency * 5, sectorResources);
			rewards.gainedEvidence = 1;
					
			return rewards;
		},
		
		getScoutLocaleRewards: function (localeVO) {
			var rewards = new ResultVO();
			
            var availableResources = this.playerLocationNodes.head.entity.get(SectorFeaturesComponent).resources.clone();
			availableResources.addAll(localeVO.getResourceBonus(this.gameState.unlockedFeatures.resources));
			var efficiency = this.getScavengeEfficiency();
			var itemsComponent = this.playerStatsNodes.head.entity.get(ItemsComponent);
			var playerPos = this.playerLocationNodes.head.position;
			var levelOrdinal = this.gameState.getLevelOrdinal(playerPos.level);
			var localeDifficulty = localeVO.requirements.vision + localeVO.costs.stamina;
			
			rewards.gainedResources = this.getRewardResources(1, efficiency * localeDifficulty / 15, availableResources);
			rewards.gainedItems = this.getRewardItems(0.2, localeDifficulty / 2, itemsComponent, levelOrdinal);
			rewards.gainedInjuries = this.getResultInjuries();
			rewards.gainedEvidence = 1;
					
			return rewards;
		},
		
        getFadeOutResults: function (loseInventoryProbability, injuryProbability) {
            var resultVO = new ResultVO();
            if (loseInventoryProbability > Math.random()) {
                resultVO.lostResources = this.playerResourcesNodes.head.resources.resources.clone();
                var playerItems = this.playerResourcesNodes.head.entity.get(ItemsComponent).getAll();
                for (var i = 0; i < playerItems.length; i++) {
                    if (playerItems[i].type !== ItemConstants.itemTypes.bag) resultVO.lostItems.push(playerItems[i].clone());
                }
            }
            
            if (injuryProbability > Math.random()) {
				var injuryi = parseInt(Math.random() * PerkConstants.perkDefinitions.injury.length);
				var injury = PerkConstants.perkDefinitions.injury[injuryi];
                resultVO.gainedInjuries.push(injury);
            }
            
            return resultVO;
        },
		
		collectRewards: function (rewards) {
			var currentStorage = this.resourcesHelper.getCurrentStorage(true);
			currentStorage.addResources(rewards.gainedResources);
			currentStorage.substractResources(rewards.lostResources);
			
			var sectorStatus = this.playerLocationNodes.head.entity.get(SectorStatusComponent);
			for (var key in resourceNames) {
				var name = resourceNames[key];
				var amount = rewards.gainedResources.getResource(name);
				if (amount > 0) {
					sectorStatus.addDiscoveredResource(name);
				}
			}
			
			var itemsComponent = this.playerStatsNodes.head.entity.get(ItemsComponent);
			if (rewards.gainedItems) {
				for (var i = 0; i < rewards.gainedItems.length; i++) {
					itemsComponent.addItem(rewards.gainedItems[i]);
				}
			}
			
			if (rewards.lostItems) {
				for (var i = 0; i < rewards.lostItems.length; i++) {
					itemsComponent.discardItem(rewards.lostItems[i]);
				}
			}
			
			if (rewards.gainedInjuries) {
				var perksComponent = this.playerStatsNodes.head.entity.get(PerksComponent);
				for (var i = 0; i < rewards.gainedInjuries.length; i++) {
					perksComponent.addPerk(rewards.gainedInjuries[i].clone());
				}
			}
			
			if (rewards.gainedEvidence) this.playerStatsNodes.head.evidence.value += rewards.gainedEvidence;
		},
		
		getRewardsMessage: function (rewards, baseMsg) {
			var msg = baseMsg;
			var replacements = [];
			var values = [];
			var foundSomething = rewards.gainedResources.getTotal() > 0;
			
			var resourceTemplate = TextConstants.getLogResourceText(rewards.gainedResources);
			msg += "Found " + resourceTemplate.msg;
			replacements = replacements.concat(resourceTemplate.replacements);
			values = values.concat(resourceTemplate.values);
			
			if (rewards.gainedItems) {
				if (rewards.gainedItems.length > 0) {
					msg += ", ";
					foundSomething = true;
				}
				
				for (var i = 0; i < rewards.gainedItems.length; i++) {
					var item = rewards.gainedItems[i];
					msg += "$" + replacements.length + ", ";
					replacements.push("#" + replacements.length);
					values.push(item.name);
				}
			}
			
			if (rewards.gainedEvidence) {
				msg += ", ";
				foundSomething = true;
				msg += "$" + replacements.length + ", ";
				replacements.push("#" + replacements.length + " evidence");
				values.push(rewards.gainedEvidence);
			}
			
			if (foundSomething) {
				msg = msg.slice(0, -2);
				msg += ".";
			} else {
				msg = "Didn't find anything.";
			}
			
			// TODO add perks (injuries)
			
			return { msg: msg, replacements: replacements, values: values };
		},
		
		getScavengeEfficiency: function () {
			var playerVision = this.playerStatsNodes.head.vision.value;
			var playerHealth = this.playerStatsNodes.head.stamina.health;
            return (playerHealth / 100) * (playerVision / 100);
        },
        
		getRewardResources: function (probabilityFactor, amountFactor, availableResources) {
			var results = new ResourcesVO();
			for (var key in resourceNames) {
				var name = resourceNames[key];
				var resAmount = availableResources.getResource(name);
				var probability = 0.2;
				var resAmountFactor = 1;
				if (name === "metal") {
					probability = 0.98;
					resAmountFactor = 2;
				} else if (name === "water" || name === "food") {
					probability = 0.3;
					resAmountFactor = 3;
				}
				probability = probability * probabilityFactor;
				var resultAmount = Math.random() < probability ?
					Math.ceil(amountFactor * resAmountFactor * resAmount * Math.random()) :
					0;
		
				results.setResource(name, resultAmount);
			}
			
			return results;
		},
	
		// probability of getting something: 0-1 for one item
		// typical rarity of items: 0-100
		getRewardItems: function (itemProbability, itemRarity, currentItems, levelOrdinal) {
			var items = [];
			
			// Neccessity items that the player should find quickly if missing
			var necessityItem = this.getNecessityItem(currentItems);
			if (necessityItem && Math.random() < itemProbability * 33) {
				items.push(necessityItem);
			}
			
			// TODO define and use item rarity
			
			// Normal items
			if (Math.random() < itemProbability) {
				var itemTypeRand = Math.random();
				if (itemTypeRand < 0.2) {
					items.push(ItemConstants.itemDefinitions.shoes[0].clone());
				} else if (itemTypeRand < 0.25) {
					var i = Math.floor(Math.random()*ItemConstants.itemDefinitions.bag.length - 1);
					items.push(ItemConstants.itemDefinitions.bag[i + 1].clone());
				} else if (itemTypeRand < 0.5) {
					items.push(ItemConstants.getDefaultClothing(levelOrdinal));
				} else if (itemTypeRand < 0.75) {
					items.push(ItemConstants.getDefaultWeapon(levelOrdinal));
				} else if (itemTypeRand < 0.8) {
					items.push(ItemConstants.itemDefinitions.light[1].clone());
				} else {
					var i = Math.floor(Math.random()*ItemConstants.itemDefinitions.artefact.length);
					items.push(ItemConstants.itemDefinitions.artefact[i].clone());
				}
			}
			return items;
		},
		
		getNecessityItem: function (currentItems) {
			if (currentItems.getCurrentBonus(ItemConstants.itemTypes.bag) <= 0) {
				return ItemConstants.itemDefinitions.bag[0];
			}			
			return null;
		},
		
		getResultInjuries: function () {
			// TODO injuries perks for sca/fi/i
			return {};
		},
        
    });
    
    return PlayerActionResultsHelper;
});
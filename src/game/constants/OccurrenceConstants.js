define(['ash', 'utils/MathUtils', 'game/constants/CampConstants', 'game/constants/GameConstants'],
function (Ash, MathUtils, CampConstants, GameConstants) {

    var OccurrenceConstants = {
	
		campOccurrenceTypes: {
			trader: "trader",
			raid: "raid",
		},
		
		OCCURRENCE_CAMP_TRADER_LENGTH: 60 * 5,
		OCCURRENCE_CAMP_TRADER_COOLDOWN: 60 * 20,
		OCCURRENCE_CAMP_TRADER_VARIATION: 60 * 75,
		OCCURRENCE_CAMP_TRADER_START: 60,
		OCCURRENCE_CAMP_TRADER_VARIATION_START: 60 * 3,
		
		OCCURRENCE_CAMP_RAID_LENGTH: 5,
		OCCURRENCE_CAMP_RAID_COOLDOWN: 60 * 15,
		OCCURRENCE_CAMP_RAID_VARIATION: 60 * 60,
		
		getTimeToNext: function (occurrenceType, isNew, upgradeFactor, campPopulation, campMaxPopulation) {
			var minimumTime = 1;
            var baseTime = 1;
			var randomFactor = Math.random();

            var pop = (campPopulation + campMaxPopulation)/2;
            var populationFactor = MathUtils.clamp(2.25-Math.log(pop+1)/2.5, 0.5, 2);
			
            switch (occurrenceType) {
				case this.campOccurrenceTypes.trader:
                    if (isNew) {
    					minimumTime = this.OCCURRENCE_CAMP_TRADER_START;
    					baseTime = this.OCCURRENCE_CAMP_TRADER_VARIATION_START;
                    } else {
    					minimumTime = this.OCCURRENCE_CAMP_TRADER_COOLDOWN;
    					baseTime = this.OCCURRENCE_CAMP_TRADER_VARIATION;
                    }
					break;
				
				case this.campOccurrenceTypes.raid:
					minimumTime = this.OCCURRENCE_CAMP_RAID_COOLDOWN;
					baseTime = this.OCCURRENCE_CAMP_RAID_VARIATION;
					break;
			}
            
            minimumTime *= Math.max(1, populationFactor);
            
            var result = Math.floor(minimumTime + baseTime * randomFactor * upgradeFactor * populationFactor);
            return result / GameConstants.gameSpeedCamp;
		},
		
		getDuration: function(occurrenceType) {
			switch(occurrenceType) {
			case this.campOccurrenceTypes.trader:
				return this.OCCURRENCE_CAMP_TRADER_LENGTH;
			
			case this.campOccurrenceTypes.raid:
				return this.OCCURRENCE_CAMP_RAID_LENGTH;
			}
			return 0;
		},
		
		getRaidDanger: function (improvements, soldiers, soldierLevel) {
			var dangerPoints = this.getRaidDangerPoints(improvements)
			var defencePoints = this.getRaidDefencePoints(improvements, soldiers, soldierLevel);
            var result = (dangerPoints - defencePoints) / 25;
			return Math.max(0, Math.min(1, result));
		},
        
        getRaidDangerPoints: function (improvements) {
			var dangerPoints = 0;
			dangerPoints += improvements.getTotal(improvementTypes.camp);
			dangerPoints -= improvements.getCount(improvementNames.home);
            dangerPoints -= improvements.getCount(improvementNames.fortification);
            dangerPoints -= improvements.getCount(improvementNames.fortification2);
            return dangerPoints;
        },
		
		getRaidDefencePoints: function (improvements, soldiers, soldierLevel) {
            return CampConstants.CAMP_BASE_DEFENCE + this.getFortificationsDefencePoints(improvements) + this.getSoldierDefencePoints(soldiers, soldierLevel);
		},
        
        getRaidDefenceString: function (improvements, soldiers, soldierLevel) {
            var result = "Base: " + CampConstants.CAMP_BASE_DEFENCE;
            var fortificationsPoints = this.getFortificationsDefencePoints(improvements);
            if (fortificationsPoints > 0) result += "<br/>Fortifications:" + fortificationsPoints;
            var soldierPoints = this.getSoldierDefencePoints(soldiers, soldierLevel);
            if (soldierPoints > 0) result += "<br/>Soldiers:" + soldierPoints;
            return result;
		},
        
        getFortificationsDefencePoints: function (improvements) {
			var regularFortifications = improvements.getCount(improvementNames.fortification);
            var improvedFortifications = improvements.getCount(improvementNames.fortification2);
            return regularFortifications * CampConstants.FORTIFICATION_1_DEFENCE + improvedFortifications * CampConstants.FORTIFICATION_2_DEFENCE;
        },
        
        getSoldierDefencePoints: function (soldiers, soldierLevel) {
            return soldiers * CampConstants.getSoldierDefence(soldierLevel);
        },
	
    };
    
    return OccurrenceConstants;
    
});

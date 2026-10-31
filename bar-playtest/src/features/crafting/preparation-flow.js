/* Recipe selection, ingredients, tools and preparation tutorial. State stays on the owning instance; dependencies are explicit. */
(function (root) {
  'use strict';
  function create({  }) {
    return class GamePreparation {
    openRecipes() {
      if (this.tutorial && (this.tutorial.kind !== 'recipe' || !this.tutorial.serviceOpened)) return false;
      if (this.screen !== 'bar' || this.error || this.isPaused() || this.transition > 0) return false;
      if (this.phase === 'general' || this.phase === 'practice' || this.currentOrder && this.story?.steps[this.story.index]?.type === 'craft') {
        if (this.drink) return false;
        if (this.tutorial?.kind === 'recipe') {
          this.tutorial = {
            kind: 'recipeSelect',
            beer: !!this.tutorial.beer
          };
          this.log('tutorial_complete', {
            kind: 'recipe'
          });
        }
        this.screen = 'recipe';
        this.changed();
        return true;
      }
      return false;
    }
    closeRecipes() {
      if (this.tutorial) return false;
      if (this.screen !== 'recipe') return;
      this.screen = 'bar';
      this.changed();
    }
    selectCocktail(id) {
      if (this.tutorial && (this.tutorial.kind !== 'recipeSelect' || id !== (this.tutorial.beer ? 'bottle_beer' : 'gin_tonic'))) return false;
      if (this.screen !== 'recipe' || !this.cocktailsAvailable().some(c => c.id === id)) return false;
      if (this.currentOrder?.freeChoice) {
        this.currentOrder.cocktail = id;
        this.resultContext.ordered = id;
      }
      this.prep = {
        selected: id,
        glass: null,
        tool: null,
        ingredients: []
      };
      this.screen = 'prep';
      if (this.tutorial?.kind === 'recipeSelect') this.tutorial = this.tutorial.beer ? {
        kind: 'beerGlass',
        beer: true
      } : {
        kind: 'prepRecipeOpen'
      };
      this.changed();
      return true;
    }
    tutorialEvent(event, value) {
      const t = this.tutorial;
      if (!t || this.screen !== 'prep' || this.isPaused()) return false;
      if (t.beer) {
        const route = {
          beerToolNavigate: ['tool', 'beerOpener'],
          beerFridgeNavigate: ['fridge', 'beerAdd']
        };
        const next = route[t.kind];
        if (event !== 'shelf' || !next || value !== next[0]) return false;
        t.kind = next[1];
        this.changed();
        return true;
      }
      const route = {
        prepRecipeOpen: ['recipeOpen', 'prepRecipeRead'],
        prepRecipeRead: ['read', 'prepRecipeClose'],
        prepRecipeClose: ['recipeClose', 'prepNavigate'],
        prepNavigate: ['shelf', 'prepHover'],
        prepHover: ['hover', 'prepAdd']
      };
      if (this.variant !== 'gpt') {
        route.prepRecipeClose = ['recipeClose', 'prepGlass'];
        route.prepNavigate = ['shelf', 'prepHover'];
        route.prepSodaNavigate = ['shelf', 'prepSodaHover'];
        route.prepSodaHover = ['hover', 'prepSodaAdd'];
        if (event === 'shelf' && value !== (t.kind === 'prepNavigate' ? 'liquor' : 'fridge')) return false;
      }
      const next = route[t.kind];
      if (!next || next[0] !== event) return false;
      this.log('tutorial_action', {
        kind: t.kind,
        event
      });
      t.kind = next[1];
      this.changed();
      return true;
    }
    pickItem(id) {
      if (this.tutorial) {
        const allowed = this.tutorial.beer ? {
          beerGlass: this.cocktail('bottle_beer').glass,
          beerAdd: 'beer'
        } : this.variant === 'gpt' ? {
          prepAdd: 'gin',
          prepRemove: 'gin'
        } : {
          prepGlass: 'long_drink',
          prepAdd: 'gin',
          prepRemove: 'gin',
          prepGinAgain: 'gin',
          prepSodaAdd: 'soda_water'
        };
        if (allowed[this.tutorial.kind] !== id) return false;
      }
      if (this.screen !== 'prep' || this.isPaused()) return;
      const item = this.itemsAvailable().find(i => i.id === id);
      if (!item) return;
      if (item.kind === 'ingredient') {
        const i = this.prep.ingredients.indexOf(id);
        if (i >= 0) this.prep.ingredients.splice(i, 1);else {
          const before = this.prep.ingredients.length;
          this.prep.ingredients.push(id);
          if (before < 10 && this.prep.ingredients.length >= 10) this.overlay = 'ingredientWarning';
        }
      } else if (item.kind === 'glass') this.prep.glass = this.prep.glass === id ? null : id;else if (item.kind === 'tool') {
        this.prep.tool = this.prep.tool === id ? null : id;
        if (this.prep.tool) this.prep.opener = false;
      }
      if (this.tutorial?.beer) {
        this.tutorial.kind = this.tutorial.kind === 'beerGlass' ? 'beerToolNavigate' : 'beerStart';
        this.changed();
        return true;
      }
      if (this.tutorial?.kind === 'prepAdd' && this.prep.ingredients.includes('gin')) {
        this.tutorial.kind = 'prepRemove';
        this.log('tutorial_action', {
          event: 'add',
          ingredient: id
        });
      } else if (this.tutorial?.kind === 'prepRemove' && !this.prep.ingredients.includes('gin')) {
        if (this.variant === 'gpt') {
          this.tutorial = null;
          this.progress.flags.day0_recipe_taught = true;
          this.log('tutorial_complete', {
            kind: 'prep'
          });
        } else this.tutorial.kind = 'prepGinAgain';
      } else if (this.variant !== 'gpt' && this.tutorial) {
        const next = {
          prepGlass: 'prepNavigate',
          prepGinAgain: 'prepSodaNavigate',
          prepSodaAdd: 'prepStart'
        }[this.tutorial.kind];
        if (next) {
          this.log('tutorial_action', {
            kind: this.tutorial.kind,
            event: 'pick',
            ingredient: id
          });
          this.tutorial.kind = next;
        }
      }
      this.changed();
    }
    pickOpener() {
      if (this.screen !== 'prep' || this.isPaused() || this.tutorial && (!this.tutorial.beer || this.tutorial.kind !== 'beerOpener')) return false;
      this.prep.opener = !this.prep.opener;
      if (this.prep.opener) this.prep.tool = null;
      if (this.tutorial?.beer) this.tutorial.kind = 'beerFridgeNavigate';
      this.changed();
      return true;
    }
    prepBack() {
      if (this.tutorial) return false;
      if (this.screen !== 'prep') return;
      this.prep = null;
      this.screen = 'recipe';
      this.log('prep_reset');
      this.changed();
    }
    };
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaGameParts ||= {}).preparation = create;
})(typeof window === 'undefined' ? globalThis : window);

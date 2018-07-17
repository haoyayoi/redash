import moment from 'moment';
import { extend, isString } from 'lodash';

import { LivePaginator } from '@/lib/pagination';
import template from './queries-list.html';

class QueriesListCtrl {
  constructor($scope, $location, Events, Query, currentUser) {
    const page = parseInt($location.search().page || 1, 10);

    this.term = $location.search().q;
    if (isString(this.term) && this.term !== '') {
      Events.record('search', 'query', '', { term: this.term });
    }

    this.defaultOptions = {};

    // use $parent because we're using a component as route target instead of controller;
    // $parent refers to scope created for the page by router
    this.resource = $scope.$parent.$resolve.resource;
    this.currentPage = $scope.$parent.$resolve.currentPage;

    this.currentUser = currentUser;
    this.showMyQueries = currentUser.hasPermission('create_query');

    this.showEmptyState = false;
    this.loaded = false;

    this.selectedTags = new Set();
    this.onTagsUpdate = (tags) => {
      this.selectedTags = tags;
      this.update();
    };

    this.isInSearchMode = () => this.term !== undefined && this.term !== null && this.term.length > 0;

    const queriesFetcher = (requestedPage, itemsPerPage, paginator) => {
      $location.search('page', requestedPage);

      const request = Object.assign({}, this.defaultOptions, {
        page: requestedPage,
        page_size: itemsPerPage,
        tags: [...this.selectedTags], // convert Set to Array
      });

      if (isString(this.term) && this.term !== '') {
        request.q = this.term;
      }

      if (this.term === '') {
        this.term = null;
      }
      $location.search('q', this.term);

      this.loaded = false;

      return this.resource(request).$promise.then((data) => {
        this.loaded = true;
        const rows = data.results.map((query) => {
          query.created_at = moment(query.created_at);
          query.retrieved_at = moment(query.retrieved_at);
          return new Query(query);
        });

        paginator.updateRows(rows, data.count);

        if (data.count === 0) {
          if (this.isInSearchMode()) {
            this.emptyType = 'search';
          } else if (this.selectedTags.size > 0) {
            this.emptyType = 'tags';
          } else if (this.currentPage === 'favorites') {
            this.emptyType = 'favorites';
          } else if (this.currentPage === 'my') {
            this.emptyType = 'my';
          } else {
            this.emptyType = 'default';
          }
        }
        this.showEmptyState = data.count === 0;
      });
    };

    this.navigateTo = ($event, url) => {
      if ($event.altKey || $event.ctrlKey || $event.metaKey || $event.shiftKey) {
        // keep default browser behavior
        return;
      }
      $event.preventDefault();
      $location.url(url);
    };

    this.paginator = new LivePaginator(queriesFetcher, { page });

    this.update = () => {
      // `queriesFetcher` will be called by paginator
      this.paginator.setPage(1);
    };
  }
}

export default function init(ngModule) {
  ngModule.component('pageQueriesList', {
    template,
    controller: QueriesListCtrl,
  });

  const route = {
    template: '<page-queries-list></page-queries-list>',
    reloadOnSearch: false,
  };

  return {
    '/queries': extend(
      {
        title: 'Queries',
        resolve: {
          currentPage: () => 'all',
          resource(Query) {
            'ngInject';

            return Query.query.bind(Query);
          },
        },
      },
      route,
    ),
    '/queries/my': extend(
      {
        title: 'My Queries',
        resolve: {
          currentPage: () => 'my',
          resource: (Query) => {
            'ngInject';

            return Query.myQueries.bind(Query);
          },
        },
      },
      route,
    ),
    '/queries/favorite': extend(
      {
        title: 'Favorite Queries',
        resolve: {
          currentPage: () => 'favorites',
          resource: (Query) => {
            'ngInject';

            return Query.favorites.bind(Query);
          },
        },
      },
      route,
    ),
    // TODO: setup redirect?
    // '/queries/search': _.extend(
  };
}

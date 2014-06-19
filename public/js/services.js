'use strict';

/* Services */
angular.module('spotlistr.services', [])
	.value('version', '0.1')
	.factory('UserFactory', function($http, $rootScope) {
		return {
			currentUser: function() {
				return JSON.parse(window.localStorage.getItem('currentUser'));
			},
			setCurrentUser: function(userJson) {
				window.localStorage.setItem('currentUser', JSON.stringify(userJson));
			},
			getUserId: function() {
				var user = this.currentUser();
				return user.id;
			},
			userLoggedIn: function() {
				return this.currentUser() !== null && this.currentUser() !== undefined && this.currentUser() != "null";
			},
			getAccessToken: function() {
				return window.localStorage.getItem('access_token');
			},
			setAccessToken: function(access_token) {
				window.localStorage.setItem('access_token', access_token);
			},
			getRefreshToken: function() {
				return window.localStorage.getItem('refresh_token');
			},
			setRefreshToken: function(refresh_token) {
				window.localStorage.setItem('refresh_token', refresh_token);
			},
			getNewAccessToken: function(successCallback, errorCallback) {
				$http.get('/refresh_token?refresh_token=' + this.getRefreshToken()).success(successCallback).error(errorCallback);
			},
			getSpotifyUserInfo: function() {
				var _this = this;
				$http.defaults.headers.common.Authorization = 'Bearer ' + this.getAccessToken();
				$http.get('https://api.spotify.com/v1/me').success(function(response) {
					// Update the stored data
					_this.setCurrentUser(response);
					// Broadcast the event so that the menu can to consume it
					// along with any other controllers that may be consuming it
					$rootScope.$broadcast('userChanged', {
						'currentUser': _this.currentUser(),
						'userLoggedIn': _this.userLoggedIn()
					});
				});
			}
		}
	})
	.factory('SpotifySearchFactory', function($http) {
		return {
			search: function(query, callback) {
				// https://developer.spotify.com/web-api/search-item/
				var req = 'https://api.spotify.com/v1/search?type=track&q=' + encodeURIComponent(query);
				$http.get(req).success(callback);
			}
		}
	})
	.factory('SpotifyPlaylistFactory', function($http, UserFactory) {
		return {
			create: function(name, user_id, access_token, is_public, callback, errorCallback) {
				$http.defaults.headers.common.Authorization = 'Bearer ' + access_token;
				// https://developer.spotify.com/web-api/create-playlist/
				// Endpoint: POST https://api.spotify.com/v1/users/{user_id}/playlists
				$http.post(
					'https://api.spotify.com/v1/users/' + encodeURIComponent(user_id) + '/playlists',
					{
						'name' : name,
						'public' : is_public
					}
				).success(callback).error(errorCallback);
			},
			addTracks: function(user_id, playlist_id, access_token, arr, callback) {
				// https://developer.spotify.com/web-api/add-tracks-to-playlist/
				// POST https://api.spotify.com/v1/users/{user_id}/playlists/{playlist_id}/tracks
				$http.defaults.headers.common.Authorization = 'Bearer ' + access_token;
				if (arr.length > 100) {
					// TODO: Spotify limits to adding 100 songs at a time
					//       we need to handle this
				}
				$http.post(
					'https://api.spotify.com/v1/users/' + encodeURIComponent(user_id) + '/playlists/' + encodeURIComponent(playlist_id) + '/tracks?uris=' + arr.join(",")).success(callback);
			}
		}
	})
	.factory('QueryFactory', function(SpotifySearchFactory) {
		return {
			normalizeSearchQuery: function(query) {
				return query.replace(/[^\w\s]/gi, '');
			},
			normalizeSearchArray: function(arr) {
				var normalizedArray = new Array(arr.length);
				for (var i = 0; i < arr.length; i += 1) {
					normalizedArray[i] = this.normalizeSearchQuery(arr[i]);
				}
				return normalizedArray;
			},
			createDisplayName: function(track) {
				var result = '';
				for (var i = 0; i < track.artists.length; i += 1) {
					if (i < track.artists.length - 1) {
						result += track.artists[i].name + ', ';
					} else {
						result += track.artists[i].name;
					}
				}
				result += ' - ' + track.name;
				return result;
			},
			createSpotifyUriFromTrackId: function(id) {
				return 'spotify:track:' + id;
			},
			performSearch: function(inputByLine, matches, toBeReviewed, selectedReviewedTracks, noMatches) {
				for (var i = 0; i < inputByLine.length; i += 1) {
					SpotifySearchFactory.search(inputByLine[i], function(response) {
						if (response.tracks.items.length > 1) {
							toBeReviewed.push(response);
							selectedReviewedTracks[response.tracks.href] = response.tracks.items[0].id;
						} else if (response.tracks.items.length === 1) {
							matches.push(response);
						} else {
							noMatches.push(response);
						}
					});
				}
			},
			assignSelectedTrack: function(trackUrl, trackId, selectedReviewedTracks) {
				selectedReviewedTracks[trackUrl] = trackId;
			},
			gatherPlaylist: function (matches, selectedReviewedTracks) {
				var playlist = [];
				// Add all of the 100% matches
				for (var i = 0; i < matches.length; i += 1) {
					playlist.push(this.createSpotifyUriFromTrackId(matches[i].tracks.items[0].id));
				}
				// Add the selected songs for the to-be-reviewed songs
				for (var prop in selectedReviewedTracks) {
					if (selectedReviewedTracks.hasOwnProperty(prop)) {
						playlist.push(this.createSpotifyUriFromTrackId(selectedReviewedTracks[prop]));
					}
				}
				// TODO: Do something better with the ones that we couldn't find
				return playlist;
			}
		}
	})
	.factory('RedditFactory', function($http) {
		return {
			getSubreddit: function(subreddit, sort, callback) {
				// http://www.reddit.com/r/trap/hot.json
				var req = 'http://www.reddit.com/r/' + subreddit + '/' + sort + '.json';
				console.log(req);
				$http.get(req).success(callback);
			}
		}
	});
